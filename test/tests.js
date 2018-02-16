
/*
 * requirejs, assert, mocha and jquery installed via node
 */

var requirejs = require('requirejs');
var assert = require("assert");
var $ = require("jquery");

requirejs.config({
    baseUrl: ".",
    paths: {
        tdom: "extension/tdom"
    }
});

var tdom = requirejs("tdom");

describe('Basic requirements', function() {
    describe("$", function() {
        it('should not be undefined', function() {
            assert.ok($ !== undefined);
        })
    });
    describe("tdom", function() {
        it('should not be undefined', function() {
            assert.ok(tdom !== undefined);
        })
    });
});
