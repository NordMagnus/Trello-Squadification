
/*
 * requirejs, assert, mocha and jquery installed via node
 */

const requirejs = require('requirejs');
const chai = require('chai');
// const assert = chai.assert;
const {expect} = chai;

requirejs.config({
    baseUrl: ".",
    paths: {
        chart: "test/Chart.mock",
        tdom: "extension/tdom",
        tsqd: "extension/trello-squadification",
    },
});


describe('trello-squadification', function () {

    const jsdom = require("jsdom");
    const {
        JSDOM,
    } = jsdom;

    /*
     * Load the basic DOM with a Trello board without squadification.
     */
    before(function () {
        if (!global.window) {
            return JSDOM.fromFile("test/squadification-board.html").then((dom) => {
                global.window = dom.window;
                global.$ = require('jquery');
                global.MutationObserver = require("mutation-observer");
                global.Chart = requirejs("chart");
                global.tdom = requirejs("tdom");
                global.tsqd = requirejs("tsqd");
            });
        }
        // HACK
        global.MutationObserver = require("mutation-observer");
        global.Chart = requirejs("chart");
        global.tsqd = requirejs("tsqd");
    });

    // /*
    //  * Load a DOM with squadification stuff set up.
    //  */
    // before(function() {
    //     return JSDOM.fromFile("test/squadification-board.html").then((dom) => {
    //         squadDom = dom;
    //     });
    // });

    describe('Chart.mock.js', function () {
        it("should be a class taking two parameters", function () {
            let chart = new Chart("context", {
                data: true,
                options: true,
            });
            expect(chart.data).to.be.true;
            expect(chart.options).to.be.true;
            expect(chart.context).to.equal("context");
        });
    });

    describe('initialize()', function () {


        it("should throw an error when there's no DIV#content tag", function () {
            // TODO How to test this? Alternate DOM?!?
            // const { NODOM } = jsdom('<!doctype html><html><body><div id="no-container"/></div></body></html>');
        });
        it("should return a MutationObserver object", function () {
            let observer = tsqd.initialize();
            expect(observer).to.be.instanceOf(MutationObserver);
            observer.disconnect();
        });

    });

    describe("setupBoard()", function () {

        it("should not throw any ReferenceError", function () {
            // trelloDom.reconfigure({windowTop: squadDom.window});
            // expect(window.top).to.equal(squadDom.window);
            // global.window = squadDom.window;
            expect(tsqd.setupBoard).to.not.throw(ReferenceError);
        });
        it("should not throw a TypeError without argument", function () {
            expect(tsqd.setupBoard).to.not.throw(TypeError);
        });

    });

    describe("addTeamObservers()", function () {
        it("should throw an error without argument", function () {
            expect(tsqd.addTeamObservers).to.throw(TypeError);
        });
    });

    describe("addTeamObserver()", function () {
        it("should throw TypeError when called without argument", function () {
            expect(tsqd.addTeamObserver).to.throw(TypeError);
        });
        it("should return a mutation observer", function () {
            let jList = tdom.getLists("List Alpha");
            let observer = tsqd.addTeamObserver(jList);
            expect(observer).to.be.instanceof(MutationObserver);
            observer.disconnect();
        });

    });

    describe("getTeamLists()", function () {
        it("should return # of lists without * and not constraints list", function () {
            expect(tsqd.getTeamLists()).to.have.lengthOf(2);
        });
    });

    describe("checkTeam()", function () {
        it("should throw an error without parameter", function () {
            expect(tsqd.checkTeam).to.throw(TypeError);
        });
    });

    describe("getFields()", function () {
        it("...");
    });

    describe("isConstraintsMet()", function () {
        it("should return an empty array with no constraints", function () {
            tsqd.roleConstraints = {};
            tsqd.minSize = undefined;
            tsqd.maxSize = undefined;
            tsqd.minimumConfidence = undefined;
            let violations = tsqd.isConstraintsMet(10, {});
            expect(violations).to.be.empty;
        });
    });

    describe("checkTeamRoles()", function () {

        beforeEach(function () {
            tsqd.roleConstraints = {
                "Dev": 3,
                "Tester": 2,
                "Lead": 1,
            };
        });

        it("should return an empty array when no role constraints defined", function () {
            tsqd.roleConstraints = {};
            let teamRoles = {};
            expect(tsqd.checkTeamRoles(teamRoles)).to.be.empty;
            teamRoles = {
                "Dev": 3,
                "Tester": 2,
                "Lead": 1,
            };
            expect(tsqd.checkTeamRoles(teamRoles)).to.be.empty;
        });
        it("should return an empty array when constraints met", function () {
            let teamRoles = {
                "Dev": 3,
                "Tester": 2,
                "Lead": 1,
            };
            expect(tsqd.checkTeamRoles(teamRoles)).to.be.empty;
            teamRoles = {
                "Dev": 5,
                "Tester": 3,
                "Lead": 2,
            };
            expect(tsqd.checkTeamRoles(teamRoles)).to.be.empty;
        });

        it("should return 'No Xxxx' when a role is missing", function () {
            let teamRoles = {};
            let violations = tsqd.checkTeamRoles(teamRoles);
            expect(violations).to.contain("No Dev");
            expect(violations).to.contain("No Tester");
            expect(violations).to.contain("No Lead");
            expect(violations).to.have.lengthOf(3);

            teamRoles = {
                "Dev": 2,
                "Lead": 1,
            };
            violations = tsqd.checkTeamRoles(teamRoles);
            expect(violations).to.contain("No Tester");
            expect(violations).to.have.lengthOf(2);

            teamRoles = {
                "Dev": 2,
                "Tester": 0,
                "Lead": 1,
            };
            violations = tsqd.checkTeamRoles(teamRoles);
            expect(violations).to.contain("No Tester");
            expect(violations).to.have.lengthOf(2);
        });
        it("should return 'Not enough Xxxxs' when not enough of one or more roles", function () {
            let teamRoles = {
                "Dev": 1,
                "Tester": 1,
                "Lead": 1,
            };
            let violations = tsqd.checkTeamRoles(teamRoles);
            expect(violations).to.contain("Not enough Devs");
            expect(violations).to.contain("Not enough Testers");
            expect(violations).to.have.lengthOf(2);
        });
    });

    describe("checkTeamSize()", function () {
        it("should report 'Not enough members' when team too small", function () {
            tsqd.minSize = 10;
            tsqd.maxSize = undefined;
            expect(tsqd.checkTeamSize(10)).to.contain("Not enough members");
            expect(tsqd.checkTeamSize(9)).to.contain("Not enough members");
            expect(tsqd.checkTeamSize(11)).to.be.empty;
        });
        it("should report 'Too many members' when team too small", function () {
            tsqd.minSize = undefined;
            tsqd.maxSize = 15;
            expect(tsqd.checkTeamSize(10)).to.be.empty;
            expect(tsqd.checkTeamSize(15)).to.contain("Too many members");
            expect(tsqd.checkTeamSize(16)).to.contain("Too many members");
        });
    });

    describe("countTeamMembers()", function () {
        it("should be 3 members in List Alpha", function () {
            expect(tsqd.countTeamMembers(tdom.getLists("List Alpha")[0])).to.equal(3);
        });
    });

    describe("drawTeamGraphs()", function () {
        it("should throw error if any parameter is missing", function () {
            let listEl = tsqd.getTeamLists()[0];
            expect(tsqd.drawTeamGraphs).to.throw(TypeError);
            expect(function () {
                tsqd.drawTeamGraphs(listEl);
            }).to.throw(TypeError);
            expect(function () {
                tsqd.drawTeamGraphs(undefined, true);
            }).to.throw(TypeError);
        });
    });

    describe("drawRoleDistribution()", function () {
        it("...");
    });

    describe("getTeamConfidence()", function () {
        it("should return X for any input with only with input[X] !== undefined", function () {
            let values;
            for (let i = 1; i <= 5; ++i) {
                values = [];
                values[i] = {
                    "Dev": 2,
                    "Tester": 5,
                };
                expect(tsqd.getTeamConfidence(values)).to.equal(i);
            }
            values = [];
            values[0] = {
                "Dev": 2,
                "Tester": 5,
            };
            expect(tsqd.getTeamConfidence(values)).to.be.NaN;
        });

    });
});