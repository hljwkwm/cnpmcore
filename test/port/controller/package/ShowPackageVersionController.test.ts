import assert = require('assert');
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';

describe('test/port/controller/package/ShowPackageVersionController.test.ts', () => {
  let ctx: Context;
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[GET /:fullname/:versionOrTag] show()', () => {
    it('should show one package version', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo',
        version: '1.0.0',
        versionObject: {
          description: 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .get('/foo/1.0.0')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      assert.equal(res.body.name, 'foo');
      assert.match(res.body.dist.tarball, /^http:\/\//);
      assert(res.body.dist.tarball.endsWith('/foo/-/foo-1.0.0.tgz'));
      assert.equal(res.body.dist.shasum, 'fa475605f88bab9b1127833633ca3ae0a477224c');
      assert.equal(res.body.dist.integrity, 'sha512-n+4CQg0Rp1Qo0p9a0R5E5io67T9iD3Lcgg6exmpmt0s8kd4XcOoHu2kiu6U7xd69cGq0efkNGWUBP229ObfRSA==');
      assert.equal(res.body.dist.size, 251);
      assert.equal(res.body.description, 'work with utf8mb4 💩, 𝌆 utf8_unicode_ci, foo𝌆bar 🍻');
    });

    it('should work with scoped package', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '1.0.0',
        versionObject: {
          description: 'foo description',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      await app.httpRequest()
        .get('/@cnpm/foo/1.0.0')
        .expect(200)
        .expect(res => {
          assert(res.body);
        });
    });

    it('should latest tag with scoped package', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo-tag-latest',
        version: '1.0.0',
        versionObject: {
          description: 'foo latest description',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      const res = await app.httpRequest()
        .get(`/${pkg.name}/latest`)
        .expect(200);
      assert.equal(res.body.version, '1.0.0');
    });

    it('should latest tag with not scoped package', async () => {
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg = await TestUtil.getFullPackage({
        name: 'foo-tag-latest',
        version: '2.0.0',
        versionObject: {
          description: 'foo latest description',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      let res = await app.httpRequest()
        .get(`/${pkg.name}/latest`)
        .expect(200);
      assert.equal(res.body.version, '2.0.0');

      // new beta tag
      res = await app.httpRequest()
        .put(`/-/package/${pkg.name}/dist-tags/beta`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .set('content-type', 'application/json')
        .send(JSON.stringify('2.0.0'))
        .expect(200);
      res = await app.httpRequest()
        .get(`/${pkg.name}/beta`)
        .expect(200);
      assert.equal(res.body.version, '2.0.0');

      // 404 when tag not exists
      res = await app.httpRequest()
        .get(`/${pkg.name}/beta-not-exists`)
        .expect(404);
      assert.equal(res.body.error, `[NOT_FOUND] ${pkg.name}@beta-not-exists not found`);
    });

    it('should 404 when version not exists', async () => {
      const pkg = await TestUtil.getFullPackage({
        name: '@cnpm/foo',
        version: '1.0.0',
        versionObject: {
          description: 'foo description',
        },
      });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      let res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.40000404`)
        .expect(404);
      assert.equal(res.body.error, `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`);

      // should 404 on syncMode=all when package exists
      mock(app.config.cnpmcore, 'syncMode', 'all');
      res = await app.httpRequest()
        .get(`/${pkg.name}/1.0.40000404`)
        .expect(404);
      assert.equal(res.body.error, `[NOT_FOUND] ${pkg.name}@1.0.40000404 not found`);
    });

    it('should 404 when package not exists', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/foonot-exists/1.0.40000404')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foonot-exists not found');
    });

    it('should redirect to source registry when syncMode=all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      await app.httpRequest()
        .get('/foonot-exists/1.0.40000404')
        .expect('location', 'https://registry.npmjs.org/foonot-exists/1.0.40000404')
        .expect(302);

      await app.httpRequest()
        .get('/foonot-exists/1.0.40000404?t=123')
        .expect('location', 'https://registry.npmjs.org/foonot-exists/1.0.40000404?t=123')
        .expect(302);
    });

    it('should not redirect private scope package to source registry when syncMode=all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      const res = await app.httpRequest()
        .get('/@cnpm/foonot-exists/1.0.40000404')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foonot-exists not found');
    });

    it('should not redirect private scope package to source registry when syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      const res = await app.httpRequest()
        .get('/@cnpm/foonot-exists/1.0.40000404')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] @cnpm/foonot-exists not found');
    });

    it('should redirect public scope package to source registry when syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      await app.httpRequest()
        .get('/@egg/foonot-exists/1.0.40000404')
        .expect('location', 'https://registry.npmjs.org/@egg/foonot-exists/1.0.40000404')
        .expect(302);

      await app.httpRequest()
        .get('/@egg/foonot-exists/1.0.40000404?t=123')
        .expect('location', 'https://registry.npmjs.org/@egg/foonot-exists/1.0.40000404?t=123')
        .expect(302);
    });

    it('should redirect public non scope package to source registry when syncMode=none', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'none');
      await app.httpRequest()
        .get('/foonot-exists/1.0.40000404')
        .expect('location', 'https://registry.npmjs.org/foonot-exists/1.0.40000404')
        .expect(302);

      await app.httpRequest()
        .get('/foonot-exists/1.0.40000404?t=123')
        .expect('location', 'https://registry.npmjs.org/foonot-exists/1.0.40000404?t=123')
        .expect(302);
    });
  });
});