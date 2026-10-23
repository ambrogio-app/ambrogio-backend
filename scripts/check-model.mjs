// Controlla le regole di integrità del modello che `reqvire validate` e `reqvire lint` non coprono:
// - requisiti, contratti e verifiche senza date né storia delle decisioni, fuori da citazioni e codice;
// - enunciati dei requisiti e testi dei contratti senza formule non normative;
// - ogni verifica di ispezione, analisi o dimostrazione indica «Non automatizzabile:»;
// - ogni file di governo tracciato da Git è riferito dal modello.
// Uso: node scripts/check-model.mjs [workspace]. Esce con stato 1 se trova violazioni.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = resolve(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
const reqvire = (...args) => execFileSync('npx', ['--yes', '@reqvire-org/reqvire@1.3.2', '--workspace', workspace, ...args], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
  env: { ...process.env, npm_config_loglevel: 'error' },
});

const contractTypes = ['specification', 'constraint', 'behavior', 'input-output', 'state'];
const manualTypes = ['inspection-verification', 'analysis-verification', 'demonstration-verification'];
const verificationTypes = ['test-verification', ...manualTypes];
const months = 'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre'
  + '|January|February|March|April|May|June|July|August|September|October|November|December';
const history = new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2} (?:${months}) \\d{4}\\b`
  + '|\\b(?:concordat[ao]|decis[ao]|scelt[ao])(?: con la persona)? il\\b|\\b(?:agreed|decided) on\\b', 'iu');
const modal = /(?<![\p{L}\p{N}_])(?:può|possono|potrebbe|potrebbero|dovrebbe|dovrebbero|eventualmente|may|might|could|should|possibly)(?![\p{L}\p{N}_])/giu;
const quoted = /`[^`]*`|«[^»]*»|"[^"\n]*"|“[^”]*”/gu;
const governed = [
  /^\.github\/workflows\//,
  /^\.githooks\//,
  /^scripts\//,
  /(^|\/)Dockerfile[^/]*$/,
  /(^|\/)compose[^/]*\.ya?ml$/,
  /(^|\/)\.dockerignore$/,
  /(^|\/)\.gitignore$/,
  /(^|\/)\.npmrc$/,
  /(^|\/)package\.json$/,
  /^pnpm-workspace\.yaml$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)vitest[^/]*\.config\.[^/]+$/,
];

const elements = type => Object.values(JSON.parse(reqvire('search', '--filter-type', type, '--json')).files)
  .flatMap(file => file.elements);
const statement = element => element.content.split('#### Details')[0];
const unquoted = text => text.replace(quoted, '');

const violations = [];
const requirements = elements('requirement');
const contracts = contractTypes.flatMap(elements);
const verifications = verificationTypes.flatMap(elements);

for (const element of [...requirements, ...contracts, ...verifications]) {
  if (history.test(unquoted(element.content))) {
    violations.push(`storia delle decisioni: ${element.name} (${element.file})`);
  }
}
for (const [element, text] of [
  ...requirements.map(element => [element, statement(element)]),
  ...contracts.map(element => [element, element.content]),
]) {
  for (const [word] of unquoted(text).matchAll(modal)) {
    violations.push(`formula non normativa «${word}»: ${element.name} (${element.file})`);
  }
}
for (const element of verifications.filter(element => manualTypes.includes(element.type))) {
  if (!element.content.includes('Non automatizzabile:')) {
    violations.push(`verifica manuale senza «Non automatizzabile:»: ${element.name} (${element.file})`);
  }
}

const tracked = execFileSync('git', ['-C', workspace, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const referenced = new Set(JSON.parse(reqvire('resources')).relations.map(relation => relation.file_path));
for (const path of tracked) {
  if (governed.some(pattern => pattern.test(path)) && !referenced.has(path)) {
    violations.push(`file di governo non riferito dal modello: ${path}`);
  }
}

for (const violation of violations) console.log(violation);
console.error(`${violations.length} violazioni dell'integrità del modello`);
process.exit(violations.length > 0 ? 1 : 0);
