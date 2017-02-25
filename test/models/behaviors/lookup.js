'use strict';

var assert = require('assert'),
    promiseIt = require('../../testHelpers').promiseIt,
    behaviors = require('../../../src/models/behaviors'),
    Logger = require('../../fakes/fakeLogger'),
    fs = require('fs');

describe('behaviors', function () {
    describe('#lookup', function () {
        it('should not be valid if not an array', function () {
            var errors = behaviors.validate({ lookup: {} });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: '"lookup" behavior must be an array',
                source: { lookup: {} }
            }]);
        });

        it('should not be valid if missing "key" field', function () {
            var config = {
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "key" field required',
                source: config
            }]);
        });

        it('should not be valid if missing "key.from" field', function () {
            var config = {
                    key: { using: { method: 'regex', selector: '.*' } },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "key.from" field required',
                source: config.key
            }]);
        });

        it('should not be valid if missing "key.using" field', function () {
            var config = {
                    key: { from: 'data' },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "key.using" field required',
                source: config.key
            }]);
        });

        it('should not be valid if "key.using" field is not an object', function () {
            var config = {
                    key: { from: 'data', using: 'regex' },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "key.using" field must be an object',
                source: config.key
            }]);
        });

        it('should not be valid if "key.using.method" field is missing', function () {
            var config = {
                    key: { from: 'data', using: { selector: '.*' } },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "key.using.method" field required',
                source: config.key
            }]);
        });

        it('should not be valid if "key.using.method" field is not supported', function () {
            var config = {
                    key: { from: 'data', using: { method: 'INVALID', selector: '.*' } },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "key.using.method" field must be one of [regex, xpath, jsonpath]',
                source: config.key
            }]);
        });

        it('should not be valid if "key.using.selector" field is missing', function () {
            var config = {
                    key: { from: 'data', using: { method: 'regex' } },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "key.using.selector" field required',
                source: config.key
            }]);
        });

        it('should not be valid if missing "fromDataSource" field', function () {
            var config = {
                    key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "fromDataSource" field required',
                source: config
            }]);
        });

        it('should not be valid if "fromDataSource" field is not an object', function () {
            var config = {
                    key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                    fromDataSource: 'csv',
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "fromDataSource" field must be an object',
                source: config
            }]);
        });

        it('should not be valid if "fromDataSource" key is not supported', function () {
            var config = {
                    key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                    fromDataSource: { invalid: {} },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "fromDataSource" key must be one of [csv] (other data sources may be supported in the future)',
                source: config
            }]);
        });

        it('should not be valid if "fromDataSource" object multiple keys', function () {
            var config = {
                    key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                    fromDataSource: { sql: {}, csv: { path: '', keyColumn: '', columnInto: ['key'] } },
                    into: 'TOKEN'
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "fromDataSource" field must have exactly one key',
                source: config
            }]);
        });

        it('should not be valid if missing "into" field', function () {
            var config = {
                    key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                    fromDataSource: { csv: { path: '', keyColumn: '', columnInto: ['key'] } }
                },
                errors = behaviors.validate({ lookup: [config] });
            assert.deepEqual(errors, [{
                code: 'bad data',
                message: 'lookup behavior "into" field required',
                source: config
            }]);
        });

        describe('csv', function () {
            before(function () {
                fs.writeFileSync('lookupTest.csv',
                    'name,occupation,location\n' +
                    'mountebank,tester,worldwide\n' +
                    'Brandon,mountebank,Dallas\n' +
                    'Bob Barker,"The Price Is Right","Darrington, Washington"');
            });

            after(function () {
                fs.unlinkSync('lookupTest.csv');
            });

            promiseIt('should log error and report nothing if file does not exist', function () {
                var request = { data: 'My name is mountebank' },
                    response = { data: 'Hello, ${you}["occupation"]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'data', using: { method: 'regex', selector: '\\w+$' } },
                            fromDataSource: { csv: { path: 'INVALID.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, ${you}["occupation"]' });
                    logger.error.assertLogged('Cannot read INVALID.csv: ');
                });
            });

            promiseIt('should support lookup keyed by regex match from request', function () {
                var request = { data: 'My name is mountebank' },
                    response = { data: 'Hello, ${you}["occupation"]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'data', using: { method: 'regex', selector: '\\w+$' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should support lookup keyed by regex match from request with ignoreCase', function () {
                var request = { data: 'My name is mountebank' },
                    response = { data: "Hello, ${you}['occupation']" },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: {
                                from: 'data',
                                using: { method: 'regex', selector: 'MOUNT\\w+$', options: { ignoreCase: true } }
                            },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should support lookup keyed by regex match from request with multiline', function () {
                var request = { data: 'First line\nMy name is mountebank\nThird line' },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: {
                                from: 'data',
                                using: { method: 'regex', selector: 'mount\\w+$', options: { multiline: true } }
                            },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should not replace if regex does not match', function () {
                var request = { data: 'My name is mountebank' },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: {
                                from: 'data',
                                using: { method: 'regex', selector: 'Mi nombre es (\\w+)$' }
                            },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, ${you}[occupation]' });
                });
            });

            promiseIt('should support lookup replace keyed by regex match into object response field', function () {
                var request = { data: 'My name is mountebank' },
                    response = { outer: { inner: 'Hello, ${you}["occupation"]' } },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'data', using: { method: 'regex', selector: '\\w+$' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { outer: { inner: 'Hello, tester' } });
                });
            });

            promiseIt('should support lookup replacement into all response fields', function () {
                var request = { data: 'My name is mountebank' },
                    response = { data: '${you}[location]', outer: { inner: 'Hello, ${you}[occupation]' } },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'data', using: { method: 'regex', selector: '\\w+$' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'worldwide', outer: { inner: 'Hello, tester' } });
                });
            });

            promiseIt('should support lookup replacement from object request field', function () {
                var request = { data: { name: 'My name is mountebank', other: 'ignore' } },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: { data: 'name' }, using: { method: 'regex', selector: '\\w+$' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should support lookup replacement from object request field ignoring case of key', function () {
                var request = { data: { name: 'My name is mountebank', other: 'ignore' } },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: { data: 'NAME' }, using: { method: 'regex', selector: '\\w+$' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should support lookup replacement keyed by regex indexed group from request', function () {
                var request = { name: 'My name is mountebank' },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: {
                                from: 'name',
                                using: { method: 'regex', selector: 'My name is (\\w+)' },
                                index: 1
                            },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should default to first value in multi-valued request field', function () {
                var request = { data: ['Brandon', 'mountebank', 'Bob Barker'] },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'data', using: { method: 'regex', selector: '\\w+' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, mountebank' });
                });
            });

            promiseIt('should support lookup keyed by xpath match into response', function () {
                var request = { field: '<doc><name>mountebank</name></doc>' },
                    response = { data: 'Hello, ${you}["occupation"]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'xpath', selector: '//name' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should ignore xpath if does not match', function () {
                var request = { field: '<doc><name>mountebank</name></doc>' },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'xpath', selector: '//title' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, ${you}[occupation]' });
                });
            });

            promiseIt('should ignore xpath if field is not xml', function () {
                var request = { field: '' },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'xpath', selector: '//title' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, ${you}[occupation]' });
                    logger.warn.assertLogged('[xmldom error]\tinvalid doc source\n@#[line:undefined,col:undefined] (source: "")');
                });
            });

            promiseIt('should support lookup keyed by xml attribute', function () {
                var request = { field: '<doc><tool name="mountebank">Service virtualization</tool></doc>' },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'xpath', selector: '//tool/@name' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should support lookup keyed by xml direct text', function () {
                var request = { field: '<doc><name>mountebank</name></doc>' },
                    response = { data: 'Hello, ${you}["occupation"]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'xpath', selector: '//name/text()' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should support lookup keyed by namespaced xml field', function () {
                var request = { field: '<doc xmlns:mb="http://example.com/mb"><mb:name>mountebank</mb:name></doc>' },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: {
                                from: 'field',
                                using: {
                                    method: 'xpath',
                                    selector: '//mb:name',
                                    ns: { mb: 'http://example.com/mb' }
                                }
                            },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should support lookup keyed by indexed xpath match', function () {
                var request = { field: '<doc><name>Bob Barker</name><name>mountebank</name><name>Brandon</name></doc>' },
                    response = { data: 'Hello ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'xpath', selector: '//name' }, index: 2 },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello mountebank' });
                });
            });

            promiseIt('should ignore jsonpath selector if field is not json', function () {
                var request = { field: 'mountebank' },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'jsonpath', selector: '$..name' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}[occupation]'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, ${you}[occupation]' });
                    logger.warn.assertLogged('Cannot parse as JSON: "mountebank"');
                });
            });

            promiseIt('should support lookup keyed on jsonpath selector', function () {
                var request = { field: JSON.stringify({ name: 'mountebank' }) },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'jsonpath', selector: '$..name' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, tester' });
                });
            });

            promiseIt('should not replace token if jsonpath selector does not match', function () {
                var request = { field: JSON.stringify({ name: 'mountebank' }) },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'jsonpath', selector: '$..title' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, ${you}[occupation]' });
                });
            });

            promiseIt('should support lookup keyed on indexed token with jsonpath selector', function () {
                var request = { field: JSON.stringify({
                        people: [{ name: 'mountebank' }, { name: 'Bob Barker' }, { name: 'Brandon' }] }) },
                    response = { data: 'Hello, ${you}[occupation]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'jsonpath', selector: '$..name' }, index: 1 },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'name' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, The Price Is Right' });
                });
            });

            promiseIt('should support lookup of value with embedded comma', function () {
                var request = { field: 'The Price Is Right' },
                    response = { data: 'Hello, ${you}[location]' },
                    logger = Logger.create(),
                    config = {
                        lookup: [{
                            key: { from: 'field', using: { method: 'regex', selector: '.*' } },
                            fromDataSource: { csv: { path: 'lookupTest.csv', keyColumn: 'occupation' } },
                            into: '${you}'
                        }]
                    };

                return behaviors.execute(request, response, config, logger).then(function (actualResponse) {
                    assert.deepEqual(actualResponse, { data: 'Hello, Darrington, Washington' });
                });
            });

            /*
             // case sensitivity on key lookup
             // long CSV files
             // what happens if index too big
             */

            it('should not be valid if "fromDataSource.csv" is not an object', function () {
                var config = {
                        key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                        fromDataSource: { csv: '' },
                        into: 'TOKEN'
                    },
                    errors = behaviors.validate({ lookup: [config] });
                assert.deepEqual(errors, [{
                    code: 'bad data',
                    message: 'lookup behavior "fromDataSource.csv" field must be an object',
                    source: config
                }]);
            });

            it('should not be valid if "fromDataSource.csv.path" missing', function () {
                var config = {
                        key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                        fromDataSource: { csv: { keyColumn: '', columnInto: ['key'] } },
                        into: 'TOKEN'
                    },
                    errors = behaviors.validate({ lookup: [config] });
                assert.deepEqual(errors, [{
                    code: 'bad data',
                    message: 'lookup behavior "fromDataSource.csv.path" field required',
                    source: config
                }]);
            });

            it('should not be valid if "fromDataSource.csv.path" is not a string', function () {
                var config = {
                        key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                        fromDataSource: { csv: { path: 0, keyColumn: '', columnInto: ['key'] } },
                        into: 'TOKEN'
                    },
                    errors = behaviors.validate({ lookup: [config] });
                assert.deepEqual(errors, [{
                    code: 'bad data',
                    message: 'lookup behavior "fromDataSource.csv.path" field must be a string, representing the path to the CSV file',
                    source: config
                }]);
            });

            it('should not be valid if "fromDataSource.csv.keyColumn" missing', function () {
                var config = {
                        key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                        fromDataSource: { csv: { path: '', columnInto: ['key'] } },
                        into: 'TOKEN'
                    },
                    errors = behaviors.validate({ lookup: [config] });
                assert.deepEqual(errors, [{
                    code: 'bad data',
                    message: 'lookup behavior "fromDataSource.csv.keyColumn" field required',
                    source: config
                }]);
            });

            it('should not be valid if "fromDataSource.csv.keyColumn" is not a string', function () {
                var config = {
                        key: { from: 'data', using: { method: 'regex', selector: '.*' } },
                        fromDataSource: { csv: { path: '', keyColumn: 0, columnInto: ['key'] } },
                        into: 'TOKEN'
                    },
                    errors = behaviors.validate({ lookup: [config] });
                assert.deepEqual(errors, [{
                    code: 'bad data',
                    message: 'lookup behavior "fromDataSource.csv.keyColumn" field must be a string, representing the column header to select against the "key" field',
                    source: config
                }]);
            });
        });
    });
});