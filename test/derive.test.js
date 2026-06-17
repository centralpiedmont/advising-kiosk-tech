import { test } from 'node:test';
import assert from 'node:assert/strict';
import { degreeLabel, shortLead, formatSalary, skillChips, stripHtml } from '../derive.js';

test('stripHtml removes tags and decodes common entities', () => {
  assert.equal(stripHtml('<p>Hello&mdash;world&rsquo;s &amp; more</p>'), "Hello—world's & more");
});

test('degreeLabel maps AAS titles to A.A.S.', () => {
  assert.equal(degreeLabel('Associate in Applied Science - Software Engineering'), 'A.A.S.');
  assert.equal(degreeLabel('Associate in Arts'), 'A.A.');
  assert.equal(degreeLabel('Some Certificate'), 'Some Certificate');
});

test('shortLead returns the first sentence, capped', () => {
  const ov = '<p>Software powers everything around us. In this program you will learn a lot more than one sentence holds.</p>';
  const lead = shortLead(ov);
  assert.ok(lead.startsWith('Software powers everything around us'));
  assert.ok(lead.length <= 180);
  assert.ok(!/[<>]/.test(lead));
});

test('formatSalary formats USD with no decimals', () => {
  assert.equal(formatSalary(135980), '$135,980');
  assert.equal(formatSalary(61860), '$61,860');
});

test('skillChips returns major-course names, gen-ed filtered, capped at 5', () => {
  const plan = [
    { rows: [{ code: 'ENG 111', name: 'Writing and Inquiry' }, { code: 'NET 125', name: 'Introduction to Networks' }] },
    { rows: [{ code: 'SEC 110', name: 'Security Concepts' }, { code: 'MAT 143', name: 'Quantitative Literacy' }] },
    { rows: [{ code: 'SEC 210', name: 'Intrusion Detection' }, { code: 'SEC 175', name: 'Perimeter Defense' },
             { code: 'CCT 250', name: 'Network Vulnerabilities I' }, { code: 'NET 226', name: 'Network Programmability' }] },
  ];
  const chips = skillChips(plan);
  assert.ok(!chips.includes('Writing and Inquiry'));        // ENG filtered
  assert.ok(!chips.includes('Quantitative Literacy'));      // MAT filtered
  assert.ok(chips.includes('Introduction to Networks'));
  assert.ok(chips.length <= 5);
});
