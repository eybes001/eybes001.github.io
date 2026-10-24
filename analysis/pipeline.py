#!/usr/bin/env python3
"""Reproducible UCI retail analysis. Python 3.10+ standard library only.
Raw archive -> typed immutable staging -> policy ledger -> reconciled marts -> web exports.
"""
from __future__ import annotations
import argparse
import bisect
import csv
import hashlib
import io
import json
import math
import re
import sqlite3
import sys
import urllib.request
import zipfile
from collections import Counter
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
URL = 'https://archive.ics.uci.edu/static/public/352/online%2Bretail.zip'
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
SCALE = 10000  # Exact integer ten-thousandths of GBP; display rounding happens last.
SCHEMA = ['InvoiceNo','StockCode','Description','Quantity','InvoiceDate','UnitPrice','CustomerID','Country']
PERIODS = {
 'full': ('2010-12-01','2011-12-09','Full history'),
 'complete2011': ('2011-01-01','2011-11-30','2011 · Jan–Nov'),
 'q3': ('2011-07-01','2011-09-30','Q3 2011'),
 'november': ('2011-11-01','2011-11-30','November 2011'),
}
MARKETS = {'all':'All markets','uk':'United Kingdom','international':'International'}


def price_units(value):
    value = Decimal(str(value))
    quantized = (value*SCALE).quantize(Decimal('1'),rounding=ROUND_HALF_UP)
    if abs(value - quantized/SCALE) > Decimal('0.0000001'):
        raise ValueError(f'Price exceeds supported source precision: {value}')
    return int(quantized)


def classify(invoice, sku, quantity, price):
    if price <= 0: return 'nonpositive_price'
    if not re.fullmatch(r'[0-9]{5}[A-Z]{0,2}', sku): return 'non_merchandise'
    if invoice.upper().startswith('C') and quantity < 0: return 'credit'
    if not invoice.upper().startswith('C') and quantity > 0: return 'sale'
    return 'other_adjustment'


def read_xlsx(path):
    """Read this published eight-column sheet without executing spreadsheet content."""
    with zipfile.ZipFile(path) as archive:
        shared=[]
        if 'xl/sharedStrings.xml' in archive.namelist():
            for _, element in ET.iterparse(archive.open('xl/sharedStrings.xml'), events=('end',)):
                if element.tag == NS+'si':
                    shared.append(''.join(t.text or '' for t in element.iter(NS+'t')))
                    element.clear()
        for _, row in ET.iterparse(archive.open('xl/worksheets/sheet1.xml'),events=('end',)):
            if row.tag != NS+'row': continue
            values=['']*8
            for cell in row:
                if cell.tag != NS+'c': continue
                ref=cell.attrib.get('r','')
                letters=re.match('[A-Z]+',ref)
                if not letters or len(letters[0])!=1: continue
                column=ord(letters[0])-65
                if column>=8: continue
                val=cell.find(NS+'v'); value=val.text if val is not None else ''
                if cell.attrib.get('t')=='s': value=shared[int(value)] if value else ''
                elif cell.attrib.get('t')=='inlineStr': value=''.join(t.text or '' for t in cell.iter(NS+'t'))
                values[column]=value or ''
            yield int(row.attrib['r']), values
            row.clear()


def ingest(source, database):
    conn=sqlite3.connect(database)
    conn.row_factory=sqlite3.Row
    conn.executescript('''
      DROP TABLE IF EXISTS raw_lines;
      CREATE TABLE raw_lines (
        source_row INTEGER PRIMARY KEY, invoice TEXT NOT NULL, sku TEXT NOT NULL,
        description TEXT, quantity INTEGER NOT NULL, invoice_at TEXT NOT NULL,
        unit_price_units INTEGER NOT NULL, customer TEXT, country TEXT NOT NULL,
        amount_units INTEGER NOT NULL, disposition TEXT NOT NULL, duplicate_of INTEGER
      );
    ''')
    seen={}; batch=[]; independent=Counter(); source_count=0
    iterator=read_xlsx(source)
    _, headers=next(iterator)
    if headers != SCHEMA: raise ValueError(f'Unexpected schema: {headers}')
    for rownum, values in iterator:
        if not any(values): continue
        invoice,sku,description,q,date,price,customer,country=values
        invoice=invoice.strip(); sku=sku.strip().upper(); country=country.strip()
        quantity_decimal=Decimal(q)
        if quantity_decimal != quantity_decimal.to_integral_value(): raise ValueError(f'Noninteger quantity at row {rownum}')
        quantity=int(quantity_decimal); units=price_units(price)
        timestamp=(datetime(1899,12,30)+timedelta(seconds=round(float(date)*86400))).isoformat(timespec='seconds')
        customer=str(int(Decimal(customer))) if customer else None
        key=tuple(values) # All eight source values, not invoice + SKU alone.
        duplicate_of=seen.get(key)
        disposition='duplicate' if duplicate_of is not None else classify(invoice,sku,quantity,units)
        if duplicate_of is None: seen[key]=rownum
        amount=quantity*units
        independent['raw']+=amount; independent[disposition]+=amount
        if disposition in ('sale','credit'): independent['accepted']+=amount
        batch.append((rownum,invoice,sku,description,quantity,timestamp,units,customer,country,amount,disposition,duplicate_of))
        source_count+=1
        if len(batch)>=10000:
            conn.executemany('INSERT INTO raw_lines VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',batch);batch=[]
    conn.executemany('INSERT INTO raw_lines VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',batch)
    conn.executescript('''
      CREATE INDEX idx_disposition_date ON raw_lines(disposition,invoice_at);
      CREATE INDEX idx_sku ON raw_lines(sku);
      CREATE INDEX idx_customer ON raw_lines(customer);
      DROP VIEW IF EXISTS ledger;
      CREATE VIEW ledger AS SELECT *,substr(invoice_at,1,7) month FROM raw_lines WHERE disposition IN ('sale','credit');
    ''')
    conn.commit()
    return conn, independent, source_count


def rows(conn,sql,args=()): return [dict(r) for r in conn.execute(sql,args)]
def one(conn,sql,args=()): return dict(conn.execute(sql,args).fetchone())
def gbp(value): return round((value or 0)/SCALE,4)
def ratio(n,d): return n/d if d else None

def customer_segments(conn,market,end):
    # Segment the observable customer history through the selected snapshot date.
    # A short reporting period must not erase customers who bought earlier.
    where='invoice_at < ?'
    args=[(datetime.fromisoformat(end)+timedelta(days=1)).date().isoformat()]
    if market=='uk':where+=" AND country='United Kingdom'"
    elif market=='international':where+=" AND country<>'United Kingdom'"
    data=rows(conn,f'''SELECT customer,COUNT(DISTINCT invoice) orders,MAX(invoice_at) last_order,
          SUM(amount_units) gross FROM ledger WHERE {where} AND disposition='sale' AND customer IS NOT NULL GROUP BY customer''',args)
    if not data: return [], {'customers':0,'repeat_customers':0,'threshold_gbp':0,'snapshot':end}
    values=sorted(r['gross'] for r in data)
    threshold=values[max(0,math.ceil(len(values)*.75)-1)]
    reference=datetime.fromisoformat(end)+timedelta(days=1)
    groups={name:{'label':name,'customers':0,'gross':0,'orders':0} for name in ['Champions','Loyal buyers','Recent first order','High-value, inactive','Other inactive','Developing']}
    repeat=0
    for r in data:
        recency=(reference.date()-datetime.fromisoformat(r['last_order']).date()).days
        repeat+=r['orders']>=2
        if recency>90 and r['gross']>=threshold: name='High-value, inactive'
        elif recency>90: name='Other inactive'
        elif recency<=30 and r['orders']>=5: name='Champions'
        elif r['orders']>=2: name='Loyal buyers'
        elif recency<=30: name='Recent first order'
        else: name='Developing'
        g=groups[name];g['customers']+=1;g['gross']+=r['gross'];g['orders']+=r['orders']
    result=[{**r,'gross':gbp(r['gross'])} for r in groups.values()]
    assert sum(r['customers'] for r in result)==len(data)
    return result,{'customers':len(data),'repeat_customers':repeat,'threshold_gbp':gbp(threshold),'snapshot':reference.date().isoformat()}


def make_view(conn,period,market):
    start,end,label=PERIODS[period]
    where='invoice_at >= ? AND invoice_at < ?'
    args=[start,(datetime.fromisoformat(end)+timedelta(days=1)).date().isoformat()]
    if market=='uk':where+=" AND country='United Kingdom'"
    elif market=='international':where+=" AND country<>'United Kingdom'"
    totals=one(conn,f'''SELECT COUNT(*) lines,
       SUM(CASE WHEN disposition='sale' THEN amount_units ELSE 0 END) gross,
       -SUM(CASE WHEN disposition='credit' THEN amount_units ELSE 0 END) credits,
       SUM(amount_units) net,
       COUNT(DISTINCT CASE WHEN disposition='sale' THEN invoice END) orders,
       COUNT(DISTINCT CASE WHEN disposition='credit' THEN invoice END) credit_invoices,
       COUNT(DISTINCT sku) skus, COUNT(DISTINCT country) countries,
       SUM(CASE WHEN disposition='sale' AND customer IS NOT NULL THEN amount_units ELSE 0 END) identified_gross,
       SUM(CASE WHEN disposition='sale' THEN quantity ELSE 0 END) units,
       -SUM(CASE WHEN disposition='credit' THEN quantity ELSE 0 END) credit_units
       FROM ledger WHERE {where}''',args)
    trend=rows(conn,f'''SELECT month,
      SUM(CASE WHEN disposition='sale' THEN amount_units ELSE 0 END) gross,
      -SUM(CASE WHEN disposition='credit' THEN amount_units ELSE 0 END) credits,
      SUM(amount_units) net,COUNT(DISTINCT CASE WHEN disposition='sale' THEN invoice END) orders
      FROM ledger WHERE {where} GROUP BY month ORDER BY month''',args)
    products=rows(conn,f'''SELECT sku,MAX(CASE WHEN disposition='sale' THEN description END) description,
      SUM(CASE WHEN disposition='sale' THEN amount_units ELSE 0 END) gross,
      -SUM(CASE WHEN disposition='credit' THEN amount_units ELSE 0 END) credits,
      SUM(amount_units) net, SUM(quantity) net_units,
      COUNT(DISTINCT CASE WHEN disposition='sale' THEN invoice END) orders
      FROM ledger WHERE {where} GROUP BY sku ORDER BY net DESC,sku''',args)
    countries=rows(conn,f'''SELECT country,SUM(amount_units) net,
      SUM(CASE WHEN disposition='sale' THEN amount_units ELSE 0 END) gross,
      -SUM(CASE WHEN disposition='credit' THEN amount_units ELSE 0 END) credits,
      COUNT(DISTINCT CASE WHEN disposition='sale' THEN invoice END) orders
      FROM ledger WHERE {where} GROUP BY country ORDER BY net DESC,country''',args)
    assert totals['gross']-totals['credits']==totals['net']
    assert sum(r['net'] for r in trend)==totals['net']
    assert sum(r['net'] for r in products)==totals['net']
    assert sum(r['net'] for r in countries)==totals['net']
    segments,customer=customer_segments(conn,market,end)
    # Customer cohorts use history through the snapshot; period revenue has its own denominator.
    product_net_sum=sum(max(0,r['net']) for r in products)
    positive_products=[r for r in products if r['net']>0]
    running=0;needed=0
    for r in positive_products:
        running+=r['net'];needed+=1
        if running>=.8*product_net_sum:break
    totals['top20_share']=ratio(sum(r['net'] for r in products[:20]),totals['net'])
    totals['abc80_count']=needed;totals['positive_skus']=len(positive_products)
    totals['credit_ratio']=ratio(totals['credits'],totals['gross'])
    totals['identified_share']=ratio(totals['identified_gross'],totals['gross'])
    totals['repeat_share']=ratio(customer['repeat_customers'],customer['customers'])
    totals['aov']=ratio(totals['gross']/SCALE,totals['orders'])
    for key in ('gross','credits','net','identified_gross'):totals[key]=gbp(totals[key])
    for collection in (trend,products,countries):
        for r in collection:
            for key in ('gross','credits','net'):r[key]=gbp(r[key])
            if 'sku' in r:r['credit_ratio']=ratio(r['credits'],r['gross'])
    credit_products=sorted(products,key=lambda r:(-r['credits'],r['sku']))[:20]
    return {'period':period,'market':market,'label':label,'start':start,'end':end,'summary':totals,
      'trend':trend,'products':products[:20],'credit_products':credit_products,'countries':countries,
      'segments':segments,'customer':customer},products


def write_csv(path,data):
    if not data: return
    with path.open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(data[0]),lineterminator='\n');writer.writeheader();writer.writerows(data)


def build(source,out):
    cache=ROOT/'analysis/.cache';cache.mkdir(parents=True,exist_ok=True);out.mkdir(parents=True,exist_ok=True)
    conn,independent,count=ingest(source,cache/'retail.sqlite')
    if count != 541909: raise ValueError(f'Unexpected UCI row count: {count}')
    quality=rows(conn,'''SELECT disposition,COUNT(*) rows,SUM(amount_units) amount FROM raw_lines GROUP BY disposition ORDER BY disposition''')
    assert sum(r['rows'] for r in quality)==count
    assert sum(r['amount'] for r in quality)==independent['raw']
    for r in quality: assert r['amount']==independent[r['disposition']]
    raw=one(conn,'''SELECT COUNT(*) rows,SUM(amount_units) amount,MIN(invoice_at) first_date,MAX(invoice_at) last_date,
        SUM(customer IS NULL) missing_customer,SUM(description='') missing_description FROM raw_lines''')
    views={};all_products=[]
    for period in PERIODS:
        for market in MARKETS:
            key=f'{period}:{market}';view,products=make_view(conn,period,market);views[key]=view
            if key=='full:all':all_products=products
    full=views['full:all']
    assert round(full['summary']['net']*SCALE)==independent['accepted']
    # Scope partition: additive amounts reconcile, distinct customers deliberately do not sum.
    for period in PERIODS:
        for metric in ('gross','credits','net'):
            value=views[f'{period}:uk']['summary'][metric]+views[f'{period}:international']['summary'][metric]
            assert abs(value-views[f'{period}:all']['summary'][metric])<.0001
    sourcehash=hashlib.sha256(source.read_bytes()).hexdigest()
    ledger_rows=full['summary']['lines']
    source_meta={'name':'Online Retail','creator':'Daqing Chen','year':2015,'doi':'10.24432/C5BW33',
        'url':'https://archive.ics.uci.edu/dataset/352/online+retail','download':URL,'license':'CC BY 4.0',
        'license_url':'https://creativecommons.org/licenses/by/4.0/','sha256':sourcehash,
        'retrieved':'2026-10-24','period_start':raw['first_date'][:10],'period_end':raw['last_date'][:10],
        'currency':'GBP','raw_rows':count,'ledger_rows':ledger_rows,'schema_version':1}
    quality_out=[{**r,'amount':gbp(r['amount'])} for r in quality]
    exceptions=rows(conn,'''SELECT source_row,invoice,sku,quantity,unit_price_units,amount_units,disposition,duplicate_of
       FROM raw_lines WHERE disposition NOT IN ('sale','credit') ORDER BY ABS(amount_units) DESC LIMIT 30''')
    for r in exceptions:
        r['unit_price']=gbp(r.pop('unit_price_units'));r['signed_value']=gbp(r.pop('amount_units'))
    checks=[{'name':'Source row count matches publication','status':'pass','detail':str(count)},
      {'name':'Every source row assigned exactly one disposition','status':'pass','detail':str(count)},
      {'name':'Source signed value reconciles to all dispositions','status':'pass','detail':f"GBP {gbp(independent['raw']):,.2f}"},
      {'name':'Integer ledger reconciles to independent streaming totals','status':'pass','detail':f"GBP {full['summary']['net']:,.2f}"},
      {'name':'Monthly, product and country totals reconcile','status':'pass','detail':'All 12 dashboard views'},
      {'name':'UK + international reconciles to all markets','status':'pass','detail':'Amounts only; distinct customers are recalculated'},
      {'name':'Customer segments exhaust the identified buyer population','status':'pass','detail':'All 12 dashboard views'}]
    payload={'source':source_meta,'periods':[{'id':k,'start':v[0],'end':v[1],'label':v[2]} for k,v in PERIODS.items()],
      'markets':[{'id':k,'label':v} for k,v in MARKETS.items()],'quality':quality_out,
      'profile':{'missing_customer_rows':raw['missing_customer'],'missing_description_rows':raw['missing_description'],
      'raw_signed_value':gbp(raw['amount']),'checks':checks},'views':views,'exceptions':exceptions}
    serialized=json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    (out/'retail-data.json').write_text(serialized,encoding='utf-8')
    (out/'retail-data.js').write_text('window.RETAIL_DATA = '+serialized.replace('<','\\u003c')+';\n',encoding='utf-8')
    write_csv(out/'product-performance.csv',all_products)
    write_csv(out/'monthly-performance.csv',full['trend'])
    write_csv(out/'data-quality.csv',quality_out)
    write_csv(out/'customer-segments.csv',full['segments'])
    write_csv(out/'exception-review.csv',exceptions)
    (out/'validation-report.json').write_text(json.dumps({'source':source_meta,'checks':checks},indent=2)+'\n')
    print(json.dumps({'source':source_meta,'summary':full['summary'],'quality':quality_out,'segments':full['segments'],'top_products':full['products'][:3],'top_credits':full['credit_products'][:3]},indent=2))
    conn.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,help='Path to the original Online Retail.xlsx')
    parser.add_argument('--download',action='store_true',help='Download the original UCI archive')
    parser.add_argument('--output',type=Path,default=ROOT/'assets/data')
    args=parser.parse_args()
    source=args.source
    if args.download:
        cache=ROOT/'analysis/.cache';cache.mkdir(parents=True,exist_ok=True)
        archive=cache/'online-retail.zip'
        urllib.request.urlretrieve(URL,archive)
        with zipfile.ZipFile(archive) as z:
            source=cache/'Online Retail.xlsx';source.write_bytes(z.read('Online Retail.xlsx'))
    if source is None:parser.error('Provide --source or --download')
    build(source,args.output)

if __name__=='__main__':main()
