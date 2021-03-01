import { describe, it } from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/pipeable';
import * as Files from '../../../main/ts/utils/Files';
import { Changelog, parseChangelog } from '../../../main/ts/core/Changelog';

const assert = chai.use(chaiAsPromised).assert;

describe('Changelog', () => {
  describe('parseChangelog', () => {
    it('rejects an empty changelog', () => {
      const data = '';
      const changelogE = parseChangelog(data);
      assert.isTrue(E.isLeft(changelogE));
      const errors = E.isLeft(changelogE) ? changelogE.left : [];
      assert.deepEqual(errors, [ 'No top level heading' ]);
    });
    it('parses a standard changelog', async () => {
      const data = await Files.readFileAsString('src/test/data/changelogs/test_ok_standard.md');
      const changelogE = parseChangelog(data);

      assert.isTrue(E.isRight(changelogE), 'Expected changelog to parse correctly');
      const changelog = pipe(changelogE, E.getOrElse((_errors) => assert.fail('Should be a changelog') as Changelog));
      assert.equal(changelog.source, data, 'Source should match input data');
      assert.deepEqual(changelog.preamble, { start: 0, end: 251 }, 'Expected preamble to have correct offsets');
      assert.deepEqual(changelog.links, { start: 5449, end: 5449 }, 'Expected links to be empty');
      assert.equal(changelog.releases.length, 4, 'Expected 4 changelog releases');
      const unreleased = changelog.releases[0];
      assert.isUndefined(unreleased.meta, 'First release in the list is "Unreleased" and so should not have a version or release date');
      assert.deepInclude(unreleased, {
        sections: [
          'Fixed'
        ],
        Fixed: {
          header: {
            start: 267,
            end: 276
          },
          list: {
            start: 277,
            end: 388
          },
          items: [
            {
              start: 277,
              end: 388,
              jira: 'TINY-6611'
            }
          ],
          start: 267,
          end: 388
        },
        header: {
          start: 252,
          end: 265
        },
        start: 252,
        end: 388
      });
      const release1 = changelog.releases[1];
      assert.deepInclude(release1.meta?.version, { major: 5, minor: 6, patch: 2 }, 'Expected release version to match');
      assert.equal(release1.meta?.date.toFormat('yyyy-MM-dd'), '2020-12-08', 'Expected release date to match');
      assert.deepInclude(release1, {
        sections: [
          'Fixed'
        ],
        Fixed: {
          header: {
            start: 412,
            end: 421
          },
          list: {
            start: 422,
            end: 525
          },
          items: [
            {
              start: 422,
              end: 525,
              jira: 'TINY-6783'
            }
          ],
          start: 412,
          end: 525
        },
        header: {
          start: 389,
          end: 410
        },
        start: 389,
        end: 525
      });
      const release2 = changelog.releases[2];
      assert.deepInclude(release2.meta?.version, { major: 5, minor: 6, patch: 1 }, 'Expected release version to match');
      assert.equal(release2.meta?.date.toFormat('yyyy-MM-dd'), '2020-11-25', 'Expected release date to match');
      assert.deepInclude(release2, {
        sections: [
          'Fixed'
        ],
        Fixed: {
          header: {
            start: 549,
            end: 558
          },
          list: {
            start: 559,
            end: 1005
          },
          items: [
            {
              start: 559,
              end: 668,
              jira: 'TINY-6692'
            },
            {
              start: 669,
              end: 770,
              jira: 'TINY-6681'
            },
            {
              start: 771,
              end: 885,
              jira: 'TINY-6684'
            },
            {
              start: 886,
              end: 1005,
              jira: 'TINY-6683'
            }
          ],
          start: 549,
          end: 1005
        },
        header: {
          start: 526,
          end: 547
        },
        start: 526,
        end: 1005
      });

      const release3 = changelog.releases[3];
      assert.deepInclude(release3.meta?.version, { major: 5, minor: 6, patch: 0 }, 'Expected release version to match');
      assert.equal(release3.meta?.date.toFormat('yyyy-MM-dd'), '2020-11-18', 'Expected release date to match');
      assert.deepInclude(release3, {
        sections: [
          'Added',
          'Improved',
          'Changed',
          'Fixed',
          'Security'
        ],
        Added: {
          header: {
            start: 1029,
            end: 1038
          },
          list: {
            start: 1039,
            end: 2329
          },
          items: [
            {
              start: 1039,
              end: 1195,
              jira: 'TINY-6528'
            },
            {
              start: 1196,
              end: 1279,
              jira: 'TINY-6487'
            },
            {
              start: 1280,
              end: 1379,
              jira: 'TINY-6629'
            },
            {
              start: 1380,
              end: 1558,
              jira: 'TINY-6306'
            },
            {
              start: 1559,
              end: 1712,
              jira: 'TINY-6224'
            },
            {
              start: 1713,
              end: 1829,
              jira: 'TINY-6483'
            },
            {
              start: 1830,
              end: 1929,
              jira: 'TINY-6505'
            },
            {
              start: 1930,
              end: 2019,
              jira: 'TINY-6397'
            },
            {
              start: 2020,
              end: 2136,
              jira: 'TINY-6479'
            },
            {
              start: 2137,
              end: 2232,
              jira: 'TINY-6021'
            },
            {
              start: 2233,
              end: 2329,
              jira: 'TINY-6021'
            }
          ],
          start: 1029,
          end: 2329
        },
        Improved: {
          header: {
            start: 2330,
            end: 2342
          },
          list: {
            start: 2343,
            end: 2463
          },
          items: [
            {
              start: 2343,
              end: 2463,
              jira: 'TINY-4239'
            }
          ],
          start: 2330,
          end: 2463
        },
        Changed: {
          header: {
            start: 2464,
            end: 2475
          },
          list: {
            start: 2476,
            end: 2550
          },
          items: [
            {
              start: 2476,
              end: 2550,
              jira: 'TINY-6248'
            }
          ],
          start: 2464,
          end: 2550
        },
        Fixed: {
          header: {
            start: 2551,
            end: 2560
          },
          list: {
            start: 2561,
            end: 5328
          },
          items: [
            {
              start: 2561,
              end: 2642,
              jira: 'TINY-6586'
            },
            {
              start: 2643,
              end: 2745,
              jira: 'TINY-6648'
            },
            {
              start: 2746,
              end: 2841,
              jira: 'TINY-4679'
            },
            {
              start: 2842,
              end: 2959,
              jira: 'TINY-6622'
            },
            {
              start: 2960,
              end: 3073,
              jira: 'TINY-6540'
            },
            {
              start: 3074,
              end: 3197,
              jira: 'TINY-6363'
            },
            {
              start: 3198,
              end: 3293,
              jira: 'TINY-6281'
            },
            {
              start: 3294,
              end: 3390,
              jira: 'TINY-6600'
            },
            {
              start: 3391,
              end: 3496,
              jira: 'TINY-6656'
            },
            {
              start: 3497,
              end: 3599,
              jira: 'TINY-6623'
            },
            {
              start: 3600,
              end: 3695,
              jira: 'TINY-6282'
            },
            {
              start: 3696,
              end: 3780,
              jira: 'TINY-6541'
            },
            {
              start: 3781,
              end: 3879,
              jira: 'TINY-6280'
            },
            {
              start: 3880,
              end: 3979,
              jira: 'TINY-6291'
            },
            {
              start: 3980,
              end: 4089,
              jira: 'TINY-6485'
            },
            {
              start: 4090,
              end: 4207,
              jira: 'TINY-6268'
            },
            {
              start: 4208,
              end: 4300,
              jira: 'TINY-6615'
            },
            {
              start: 4301,
              end: 4380,
              jira: 'TINY-6413'
            },
            {
              start: 4381,
              end: 4503,
              jira: 'TINY-6555'
            },
            {
              start: 4504,
              end: 4591,
              jira: 'TINY-3321'
            },
            {
              start: 4592,
              end: 4689,
              jira: 'TINY-6326'
            },
            {
              start: 4690,
              end: 4788,
              jira: 'TINY-6570'
            },
            {
              start: 4789,
              end: 4887,
              jira: 'TINY-6601'
            },
            {
              start: 4888,
              end: 4982,
              jira: 'TINY-6646'
            },
            {
              start: 4983,
              end: 5083,
              jira: 'TINY-6448'
            },
            {
              start: 5084,
              end: 5192,
              jira: 'TINY-6495'
            },
            {
              start: 5193,
              end: 5328,
              jira: 'GH-4905'
            }
          ],
          start: 2551,
          end: 5328
        },
        Security: {
          header: {
            start: 5329,
            end: 5341
          },
          list: {
            start: 5342,
            end: 5448
          },
          items: [
            {
              start: 5342,
              end: 5448,
              jira: 'TINY-6518'
            }
          ],
          start: 5329,
          end: 5448
        },
        header: {
          start: 1006,
          end: 1027
        },
        start: 1006,
        end: 5448
      });

    });
  });
});