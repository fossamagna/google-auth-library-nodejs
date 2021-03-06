/**
 * Copyright 2013 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var assert = require('assert');
var googleAuth = require('../lib/auth/googleauth.js');
var nock = require('nock');

nock.disableNetConnect();

describe('Initial credentials', function() {

  it('should create a dummy refresh token string', function () {
    // It is important that the compute client is created with a refresh token value filled
    // in, or else the rest of the logic will not work.
    var auth = new googleAuth();
    var compute = new auth.Compute();
    assert.equal('compute-placeholder', compute.credentials.refresh_token);
  });
});

describe('Compute auth client', function() {

  it('should get an access token for the first request', function (done) {
    var scope = nock('http://metadata')
      .get('/computeMetadata/v1beta1/instance/service-accounts/default/token')
      .reply(200, { access_token: 'abc123', expires_in: 10000 });
    var auth = new googleAuth();
    var compute = new auth.Compute();
    compute.request({}, function () {
      assert.equal(compute.credentials.access_token, 'abc123');
      scope.done();
      done();
    });
  });

  it('should refresh if access token has expired', function (done) {
    var scope = nock('http://metadata')
      .get('/computeMetadata/v1beta1/instance/service-accounts/default/token')
      .reply(200, { access_token: 'abc123', expires_in: 10000 });
    var auth = new googleAuth();
    var compute = new auth.Compute();
    compute.credentials.access_token = 'initial-access-token';
    compute.credentials.expiry_date = (new Date()).getTime() - 10000;
    compute.request({}, function () {
      assert.equal(compute.credentials.access_token, 'abc123');
      scope.done();
      done();
    });
  });

  it('should not refresh if access token has not expired', function (done) {
    var scope = nock('http://metadata')
      .get('/computeMetadata/v1beta1/instance/service-accounts/default/token')
      .reply(200, { access_token: 'abc123', expires_in: 10000 });
    var auth = new googleAuth();
    var compute = new auth.Compute();
    compute.credentials.access_token = 'initial-access-token';
    compute.credentials.expiry_date = (new Date()).getTime() + 10000;
    compute.request({}, function () {
      assert.equal(compute.credentials.access_token, 'initial-access-token');
      assert.equal(false, scope.isDone());
      nock.cleanAll();
      done();
    });
  });

  describe('.createScopedRequired', function () {
    it('should return false', function () {
      var auth = new googleAuth();
      var compute = new auth.Compute();
      assert.equal(false, compute.createScopedRequired());
    });
  });

  describe('._injectErrorMessage', function () {
    it('should return a helpful message on request response.statusCode 403', function (done) {
      var auth = new googleAuth();
      var compute = new auth.Compute();

      // Mock the credentials object.
      compute.credentials = {
        refresh_token: 'hello',
        access_token: 'goodbye',
        expiry_date: new Date(9999, 1, 1)
      };

      // Mock the _makeRequest method to return a 403.
      compute._makeRequest = function (opts, callback) {
        callback(null, 'a weird response body', { 'statusCode': 403 });
      };

      compute.request({ }, function (err, result, response) {
        assert.equal(403, response.statusCode);
        assert.equal('A Forbidden error was returned while attempting to retrieve an access ' +
            'token for the Compute Engine built-in service account. This may be because the ' +
            'Compute Engine instance does not have the correct permission scopes specified.',
          err.message);
        done();
      });
    });

    it('should return a helpful message on request response.statusCode 404', function (done) {
      var auth = new googleAuth();
      var compute = new auth.Compute();

      // Mock the credentials object.
      compute.credentials = {
        refresh_token: 'hello',
        access_token: 'goodbye',
        expiry_date: new Date(9999, 1, 1)
      };

      // Mock the _makeRequest method to return a 404.
      compute._makeRequest = function (opts, callback) {
        callback(null, 'a weird response body', { 'statusCode': 404 });
      };

      compute.request({ }, function (err, result, response) {
        assert.equal(404, response.statusCode);
        assert.equal('A Not Found error was returned while attempting to retrieve an access' +
            'token for the Compute Engine built-in service account. This may be because the ' +
            'Compute Engine instance does not have any permission scopes specified.',
          err.message);
        done();
      });
    });

    it('should return a helpful message on token refresh response.statusCode 403',
      function (done) {
        var auth = new googleAuth();
        var compute = new auth.Compute();

        // Mock the credentials object with a null access token, to force a refresh.
        compute.credentials = {
          refresh_token: 'hello',
          access_token: null,
          expiry_date: 1
        };

        // Mock the refreshAccessToken method to return a 403.
        compute.refreshAccessToken = function (callback) {
          callback(null, 'a weird response body', { 'statusCode': 403 });
        };

        compute.request({ }, function (err, result, response) {
          assert.equal(403, response.statusCode);
          assert.equal('A Forbidden error was returned while attempting to retrieve an access ' +
              'token for the Compute Engine built-in service account. This may be because the ' +
              'Compute Engine instance does not have the correct permission scopes specified. ' +
              'Could not refresh access token.',
            err.message);
          done();
        });
      });

    it('should return a helpful message on token refresh response.statusCode 404',
      function (done) {
        var auth = new googleAuth();
        var compute = new auth.Compute();

        // Mock the credentials object with a null access token, to force a refresh.
        compute.credentials = {
          refresh_token: 'hello',
          access_token: null,
          expiry_date: 1
        };

        // Mock the refreshAccessToken method to return a 404.
        compute.refreshAccessToken = function (callback) {
          callback(null, 'a weird response body', { 'statusCode': 404 });
        };

        compute.request({ }, function (err, result, response) {
          assert.equal(404, response.statusCode);
          assert.equal('A Not Found error was returned while attempting to retrieve an access' +
              'token for the Compute Engine built-in service account. This may be because the ' +
              'Compute Engine instance does not have any permission scopes specified. Could not ' +
              'refresh access token.',
            err.message);
          done();
        });
      });
  });
});