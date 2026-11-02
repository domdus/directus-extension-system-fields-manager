import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSupportedCollection, normalizeConfig, ruleHasTargets } from './evaluate';

test('only files and users are supported', () => {
	assert.equal(isSupportedCollection('directus_files'), true);
	assert.equal(isSupportedCollection('directus_users'), true);
	assert.equal(isSupportedCollection('articles'), false);
});

test('normalizeConfig always yields both collections', () => {
	for (const raw of [null, '', 'junk', {}]) {
		const config = normalizeConfig(raw);
		assert.equal(Array.isArray(config.collections.directus_files), true);
		assert.equal(Array.isArray(config.collections.directus_users), true);
	}
});

test('ruleHasTargets needs a role or policy', () => {
	assert.equal(ruleHasTargets({}), false);
	assert.equal(ruleHasTargets({ roles: ['r'] }), true);
});
