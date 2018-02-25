
/* global describe */
/* global it */
/* global before */
/* global tdom */

/*
 * requirejs, assert, mocha and jquery installed via node
 */

const requirejs = require('requirejs');
const chai = require('chai');
// const assert = chai.assert;
const expect = chai.expect;

requirejs.config({
    baseUrl: ".",
    paths: {
        tdom: "extension/tdom"
    }
});


describe('tdom', function() {
    
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    // var window;
    // var $;
    // var tdom;
    // const $ = require("jquery");
    
    before(function() {
        return JSDOM.fromFile("test/squadification-board.html").then((dom) => {
            global.window = dom.window;
            global.$ = require('jquery');
            global.tdom = requirejs("tdom");
        });
    });
    
    describe("dom", function() {
        it("should have a list called 'List Alpha'", function() {
            var jName = $.find("h2.js-list-name-assist:contains('List Alpha')");
            expect(jName).to.exist;
            expect(jName.length).to.equal(1);
        })
    });

    describe("definition", function() {

        it("should not be undefined", function() {
            expect(tdom).to.exist;
        })

    });

    describe("getListName()", function() {

        it("should throw an error when no parameter given", function() {
            expect(tdom.getListName).to.throw(TypeError);
        })
        it("should return 'List Alpha' when called with first js-list DIV", function() {
            var jList = $("div.list")[0];
            expect(tdom.getListName(jList)).to.equal("List Alpha");
        })

    });

    describe("getCardsByName()", function() {
        
        it("should throw an error when no cards found", function() {
            // expect(() => tdom.getCardsByName("No card")).to.throw(RangeError);
            expect(tdom.getCardsByName("No card")).to.be.null;
        })
        it("should throw an error when no parameter given", function() {
            expect(tdom.getCardsByName).to.throw(TypeError);
        })
        it("should return a jQuery object with length 2 with argument 'Twins'", function() {
            expect(tdom.getCardsByName("Twins")).to.have.lengthOf(2);
        })
        it("should return a jQuery object with length 1 with argument 'Card A1'", function() {
            expect(tdom.getCardsByName("Card A1")).to.have.lengthOf(1);
        })
        it("should return null with argument 'Card A'", function() {
            expect(tdom.getCardsByName("Card A")).to.be.null;
        })
        it("should return DOM elements of type 'a.list-card'", function() {
            var jCards = tdom.getCardsByName("Card A1");
            expect(jCards[0].tagName).to.equal("A");
            expect(jCards[0].classList.contains("list-card")).to.be.true;
        })

    });

    
    describe("countListLabels()", function() {

        it("should throw an error if no parameter", function() {
            expect(tdom.countListLabels).to.throw(TypeError);
        })
        it("should return an array with length 4 for 'List Alpha'", function() {
            let listEl = $("div.list")[0];
            let labels = tdom.countListLabels(listEl);
            expect(Object.keys(labels)).to.have.lengthOf(4);
            expect(labels["Label A"]).to.equal(2);
            expect(labels["Label B"]).to.equal(1);
        })
        it("should return an array with length 3 with filter 'C' for 'List Alpha'", function() {
            let listEl = $("div.list")[0];
            let labels = tdom.countListLabels(listEl, ["C"]);
            expect(Object.keys(labels)).to.have.lengthOf(3);  
        })

    });

    describe("getLists()", function() {
        it("should return a jQuery object with length 4 without parameters", function() {
            jLists = tdom.getLists();
            expect(jLists).to.be.instanceOf($);
            expect(jLists).to.have.lengthOf(4);
        })
        it("should return an object with length 3 with parameter 'List'", function() {
            expect(tdom.getLists("List")).to.have.lengthOf(3);
        })
        it("should return an object with length 1 with parameters '' and ['List']", function() {
            expect(tdom.getLists("", ["List"])).to.have.lengthOf(1);
        })
    });

    describe("getCardLabels()", function() {
        it("should throw an error if no parameter", function() {
            expect(tdom.getCardLabels).to.throw(TypeError);
        })
        it("should return an array with length 3 for 'List Alpha'=>'Card A1'", function() {
            let cardEl = tdom.getCardsByName("Card A1")[0];
            let labels = tdom.getCardLabels(cardEl);
            expect(labels).to.have.lengthOf(3);
        })
        it("should return an array with length 2 for 'List Alpha'=>'Card A1' and filter 'B'", function () {
            let cardEl = tdom.getCardsByName("Card A1")[0];
            let labels = tdom.getCardLabels(cardEl, ["B"]);
            expect(labels).to.has.lengthOf(2);
        })
    });

    describe("getCardFields()", function() {
        it("...")
    });
    
    describe("countLabelsInList()", function() {
        it("...")
    });
});
