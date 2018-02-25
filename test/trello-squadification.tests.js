/* global describe */
/* global it */
/* global before */
/* global tdom */
/* global tsqd */

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
        chart: "test/Chart.mock",
        tdom: "extension/tdom",
        tsqd: "extension/trello-squadification"
    }
});


describe('trello-squadification', function() {
    
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;

    /*
     * Load the basic DOM with a Trello board without squadification.
     */
    before(function() {
        if (!global.window) {
            return JSDOM.fromFile("test/squadification-board.html").then((dom) => {
                global.window = dom.window;
                global.$ = require('jquery');
                global.MutationObserver = require("mutation-observer");
                global.Chart = requirejs("chart");
                global.tdom = requirejs("tdom");
                global.tsqd = requirejs("tsqd");
            });
        } else {
            // HACK 
            global.MutationObserver = require("mutation-observer");
            global.Chart = requirejs("chart");
            global.tsqd = requirejs("tsqd");
        }
    });
    
    // /*
    //  * Load a DOM with squadification stuff set up.
    //  */
    // before(function() {
    //     return JSDOM.fromFile("test/squadification-board.html").then((dom) => {
    //         squadDom = dom;
    //     });
    // });

    describe('Chart.mock.js', function() {
        it("should be a class taking two parameters", function() {
            let chart = new Chart("context", {data: true, options: true});
            expect(chart.data).to.be.true;
            expect(chart.options).to.be.true;
            expect(chart.context).to.equal("context");
        })
    });

    describe('initialize()', function() {
        
        
        it("should throw an error when there's no DIV#content tag", function() {
            // TODO How to test this? Alternate DOM?!?
            // const { NODOM } = jsdom('<!doctype html><html><body><div id="no-container"/></div></body></html>');
        })
        it("should return a MutationObserver object", function() {
            let observer = tsqd.initialize();
            expect(observer).to.be.instanceOf(MutationObserver);
            observer.disconnect();
        })

    });

    describe("setupBoard()", function() {
    
        it("should not throw any ReferenceError", function() {
            // trelloDom.reconfigure({windowTop: squadDom.window});
            // expect(window.top).to.equal(squadDom.window);
            // global.window = squadDom.window;
            expect(tsqd.setupBoard).to.not.throw(ReferenceError);
        })
        it("should not throw a TypeError without parameter", function() {
            expect(tsqd.setupBoard).to.not.throw(TypeError);
        })

    });

    describe("addTeamObservers()", function() {
        it("should throw an error without parameter", function() {
            expect(tsqd.addTeamObservers).to.throw(TypeError);
        })
    });

    describe("addTeamObserver()", function() {
        it("...")
    });

    describe("getTeamLists()", function() {
        it("should return # of lists without * and not constraints list", function() {
            expect(tsqd.getTeamLists()).to.have.lengthOf(2);
        })
    });

    describe("checkAllTeams()", function() {
        it("...")
    });

    describe("checkTeam()", function() {
        it("should throw an error without parameter", function() {
            expect(tsqd.checkTeam).to.throw(TypeError);
        })
    });

    describe("getFields()", function() {
        it("...")
    });

    describe("isConstraintsMet()", function() {
        it("...")
    });

    describe("countTeamMembers()", function() {
        it("should be 3 members in List Alpha", function() {
            expect(tsqd.countTeamMembers(tdom.getLists("List Alpha")[0])).to.equal(3);
        })
    });

    describe("drawTeamGraphs()", function() {
        it("should throw error if any parameter is missing", function() {
            var listEl = tsqd.getTeamLists()[0];
            expect(tsqd.drawTeamGraphs).to.throw(TypeError);
            expect(function () { tsqd.drawTeamGraphs(listEl) }).to.throw(TypeError);
            expect(function () { tsqd.drawTeamGraphs(undefined, true) }).to.throw(TypeError);
        })
    });

    describe("drawRoleDistribution()", function() {
        
    });

    describe("getTeamConfidence()", function() {
        it("...")
    });
});
