import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('country_daily',Path(__file__).with_name('prawko-country-daily.py'))
daily=importlib.util.module_from_spec(spec);spec.loader.exec_module(daily)
START=dt.datetime(2026,10,7,22,tzinfo=dt.timezone.utc)
END=dt.datetime(2026,10,8,22,tzinfo=dt.timezone.utc)

class CountryReportTests(unittest.TestCase):
    def test_returning_people_not_counted_as_new_and_sessions_deduplicated(self):
        d=daily.aggregate([['returning','2026-09-01T10:00:00Z','CZ',['s1','s1','s2']],['new','2026-10-08T01:00:00Z','PL',['s3']]],START,END)
        self.assertEqual(d['countries']['CZ'],{'new_users':0,'active_users':1,'sessions':2,'revenue':None})
        self.assertEqual(d['countries']['PL']['new_users'],1)
        self.assertEqual(d['sessions_total'],3)
    def test_warsaw_boundaries_are_half_open(self):
        d=daily.aggregate([['a','2026-10-07T22:00:00Z','PL',[]],['b','2026-10-08T22:00:00Z','PL',[]]],START,END)
        self.assertEqual(d['countries']['PL']['new_users'],1)
    def test_unknown_country_not_guessed(self):
        d=daily.aggregate([['a','2026-10-08T01:00:00Z','DE',[None,'']]],START,END)
        self.assertEqual(d['countries']['UNKNOWN']['active_users'],1)
        self.assertEqual(d['users_without_session'],1)
    def test_shared_session_across_people_refused(self):
        with self.assertRaises(ValueError): daily.aggregate([['a',str(START),'CZ',['s']],['b',str(START),'CZ',['s']]],START,END)
    def test_duplicate_person_refused(self):
        with self.assertRaises(ValueError): daily.aggregate([['a',str(START),'CZ',[]],['a',str(START),'PL',[]]],START,END)
    def test_missing_canonical_identity_refused(self):
        with self.assertRaises(ValueError): daily.aggregate([['00000000-0000-0000-0000-000000000000',str(START),'CZ',[]]],START,END)
    def test_missing_money_is_not_zero(self):
        d=daily.aggregate([],START,END)
        self.assertEqual(daily.apply_revenue(d,None,dt.date(2026,10,8))['status'],'not_connected')
        self.assertIn('дані не підключено',daily.render(d,dt.date(2026,10,8)))
    def test_revenue_rejects_store_country_and_stale_day(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'money.json'
            p.write_text(json.dumps({'day':'2026-10-08','timezone':'Europe/Warsaw','country_basis':'store_country','source':'RevenueCat','complete':True}))
            with self.assertRaises(ValueError):daily.apply_revenue(daily.aggregate([],START,END),p,dt.date(2026,10,8))
    def test_currency_amounts_not_added_together(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'money.json'
            p.write_text(json.dumps({'day':'2026-10-08','timezone':'Europe/Warsaw','country_basis':'exam_country','source':'RevenueCat','complete':True,'as_of':str(END),'countries':{'PL':{'PLN':'29.99','USD':'6.40'},'CZ':{},'SK':{},'UNKNOWN':{}}}))
            d=daily.aggregate([],START,END);daily.apply_revenue(d,p,dt.date(2026,10,8))
            self.assertEqual(d['countries']['PL']['revenue'],{'PLN':'29.99','USD':'6.40'})

if __name__=='__main__':unittest.main()
