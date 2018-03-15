/*
 * requirejs, assert, mocha, sinon and jquery installed via node
 */

const requirejs = require('requirejs');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('chai-sinon');

const {
    expect,
} = chai;
chai.use(sinonChai);

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
                let MockChart = requirejs("chart");
                global.Chart = sinon.createStubInstance(MockChart);
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
                type: "test",
                data: true,
                options: true,
            });
            expect(chart.type).to.equal("test");
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

    describe("checkConcerns()", function() {
        it("should return an empty array for 'List Alpha'", function() {
            let concernList = tsqd.checkConcerns(tdom.getLists("List Alpha"));
            expect(concernList).to.be.an("array").that.is.empty;
        });
        it("should return an array with 'Low confidence...' when provided a confidence < minimum confidence", function() {
            tsqd.minimumConfidence = 3.0;
            let concernList;
            const jList = tdom.getLists("List Alpha");

            concernList = tsqd.checkConcerns(jList, 3.5);
            expect(concernList).to.be.an("array").with.lengthOf(1);
            expect(concernList[0]).to.include("Low confidence");

            concernList = tsqd.checkConcerns(jList, 3.9);
            expect(concernList).to.be.an("array").with.lengthOf(1);

            concernList = tsqd.checkConcerns(jList, 4.1);
            expect(concernList).to.be.an("array").with.lengthOf(0);

            concernList = tsqd.checkConcerns(jList, 4.5);
            expect(concernList).to.be.an("array").with.lengthOf(0);
        });
    });

    describe("getFields()", function () {
        it("should return two fields for 'List Alpha'", function() {
            let fields = tsqd.getFields("List Alpha");
            expect(fields).to.be.an("array").with.property("Field1");
            expect(fields).to.be.an("array").with.property("Field2");
            expect(Object.keys(fields)).to.have.lengthOf(2);
        });
        it("should return two fields for '' and filter ['*','Squadification Constraints']", function() {
            let fields = tsqd.getFields("", ["*", "Squadification Constraints"]);
            expect(fields).to.be.an("array").with.property("Field1");
            expect(fields).to.be.an("array").with.property("Field2");
            expect(Object.keys(fields)).to.have.lengthOf(2);
        });
    });

    describe("getCardFields()", function() {
        /*
         * [ Field1: [ 'F1.Option1': [ 'Label A': 1 ] ] ]
         */
        it("should return F1.Option1 for Card C1", function() {
            let jCard = tdom.getCardsByName("Card C1");
            let labels = tdom.getCardLabels(jCard[0]);
            expect(labels).to.be.an("array").with.lengthOf(1);
            expect(labels[0]).to.equal("Label A");
            let fields = tsqd.getCardFields(jCard[0]);
            expect(fields).to.be.an("array").with.property("Field1");
            expect(fields.Field1).to.be.an("array").with.property("F1.Option1");
            expect(fields.Field1["F1.Option1"]).to.be.an("array").with.property("Label A", 1);
        });
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
        before(function () {
            sinon.spy(tsqd, "generateRoleDistribution");
        });
        after(function () {
            tsqd.generateRoleDistribution.restore();
        });

        it("should throw error if any parameter is missing", function () {
            let jLists = tsqd.getTeamLists();
            expect(tsqd.drawTeamGraphs).to.throw(TypeError);
            expect(function () {
                tsqd.drawTeamGraphs(jLists);
            }).to.throw(TypeError);
            expect(function () {
                tsqd.drawTeamGraphs(undefined, true);
            }).to.throw(TypeError);
        });
        it("should add a div.graph-area element to the DOM", function () {
            let jlists = tsqd.getTeamLists();
            tsqd.drawTeamGraphs(jlists[0], []);
            let jArea = $("div.graph-area");
            expect(jArea).to.have.length.greaterThan(0);
            expect(jArea.length).to.equal(jlists.length);

        });
        it("should call generateRoleDistribution() once", function () {
            let jLists = tsqd.getTeamLists();
            tsqd.extractLabelColors();
            tsqd.drawTeamGraphs(jLists[0], []);
            expect(tsqd.generateRoleDistribution).to.have.been.called;
        });
    });

    describe("generateFieldGraphData()", function() {
        /*
         * {
         *   "Field 1": {
         *     "Value A": {
         *       "Label X": 3,
         *       "Label Y": 2
         *     },
         *     "Value B": {
         *       "Label X": 1,
         *       "Label Y": 0
         *     }
         *   },
         *   "Field 2": {
         *     ...
         *   }
         * }
         */
        it("should generate Chart.js datasets for stacked bar graphs", function() {
            let field = {
                "Opt1": {
                    "Lbl1": 1,
                    "Lbl2": 1,
                },
            };
            tsqd.extractLabelColors();

            let chartInfo = tsqd.generateFieldGraphData("name", field);

            expect(chartInfo).to.be.an("object").with.property("data");

            let {data} = chartInfo;

            expect(data).to.be.an("array").with.lengthOf(2); // One dataset per label
            expect(data[0]).to.be.an("object").with.property("label", "Lbl1");
            expect(data[1]).to.be.an("object").with.property("label", "Lbl2");
            expect(data[0]).to.have.property("backgroundColor");
            expect(data[0].data).to.eql([1]); // Deep equal here
        });
    });

    describe("generateConfidenceData()", function() {
        it("should generate Chart.js datasets for a stacked line graph", function() {
            let field = {
                "1": {
                    "Label A": 1,
                    "Label B": 1,
                },
                "5": {
                    "Label A": 1,
                    "Label B": 2,
                },
            };
            tsqd.extractLabelColors();
            let chartInfo = tsqd.generateConfidenceData(field);

            expect(chartInfo).to.be.an("object").with.property("data");

            let {data} = chartInfo;

            expect(data).to.be.an("array").with.lengthOf(2);
        });
    });

    describe("drawGraph()", function () {
        // let Chart = sinon.spy();
        let chartInfo;
        let jList;
        let jArea;

        before(function () {
            jList = tdom.getLists("List Alpha");
            jArea = jList.find("div.graph-area");
            chartInfo = {
                name: "test",
                labels: ["label1", "label2", "label3"],
                data: {

                },
                layout: {
                    width: "100%",
                    height: "96px",
                    class: "list-graph",
                    type: "bar",
                    legend: {
                        display: false,
                        fontSize: 12,
                        boxWidth: 20,
                    },
                    animations: 0,
                },
            };
        });
        after(function () {

        });

        it("should call Chart with type=bar if no type specified", function () {
            let chart = tsqd.drawGraph(jArea, chartInfo);
            expect(chart.type).to.equal("bar");
        });

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

    describe("showGroupStats()", function() {
        before(function() {
            sinon.spy(tsqd, "generateFieldGraphData");
            sinon.spy(tsqd, "generateRoleDistribution");
            sinon.spy(tsqd, "drawGraph");
        });
        after(function() {
            tsqd.generateFieldGraphData.restore();
            tsqd.generateRoleDistribution.restore();
            tsqd.drawGraph.restore();
        });

        it("should call generate and draw graph functions", function() {
            // let fields = tsqd.getFields("", ["*", tsqd.config.constraintsListName]);
            // expect(Object.keys(fields)).to.have.lengthOf(2);
            tsqd.showGroupStats();
            expect(tsqd.generateFieldGraphData).to.have.been.called;
            expect(tsqd.generateRoleDistribution).to.have.been.called;
            expect(tsqd.drawGraph).to.have.been.called;
        });
    });
});