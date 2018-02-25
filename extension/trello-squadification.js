/* global define */
/* global jQuery */
/* global tdom */
/* global Chart */

var tsqd = (function (factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], factory);
    } else {
        console.info("AMD not available: calling factory with jQuery");
        return factory(jQuery);
    }
}(function ($) {
    'use strict';

    var roleConstraints = []; // Role constraints, e.g. "BSA": 3
    // var constraintsListEl; // Element for list with constraints (a "js-list-content" class div)
    var constraintsObserver; // Mutation observer for constraints list
    var teamObservers = [];
    var labelColors;
    var teamMinSize;
    var teamMaxSize;
    var minConfidence;
    var picSize = 2; // Cover image size: 0=hide, 1=small (using imageHeight), 2=original

    var config = {

        constraintsListName: "Squadification Constraints",
        validTeamColor: "#86b623",
        unconfidentTeamColor: "#bb9922",
        invalidTeamColor: "#cc4400",

        imageHeight: 64,
        graphHeight: 32,
        coverBgColor: "#323232",

        debug: false
    };

    var self = {

        /**
         * Sets the debug flag. The module will output messages to the console
         * when set to `true`.
         * 
         * @param {boolean} debug `true` to spam console, otherwise `false`
         */
        setDebug(debug) {
            config.debug = debug;
        },

        /**
         * Initializes the Squadification extension by adding a `MutationObserver`
         * to the `DIV#content` element, and explicitly calling `setupBoard` in case
         * the first board loaded is a Squadification board.
         * 
         * @returns {MutationObserver} The instantiated observer
         */
        initialize() {
            let jContent = $("div#content");

            if (!jContent.length) {
                throw ReferenceError("DIV#content not found");
            }

            if (config.debug) {
                console.info("Initializing squadification board");
            }

            /*
             * The intention is that this is only called when a new board is loaded.
             */
            let trelloObserver = new MutationObserver(function (mutations) {
                if (config.debug) {
                    console.log("Observer invoked");
                    if (self.isSquadificationBoard()) {
                        console.log("...and it's a SQUAD BOARD!");
                    }
                }

                if (constraintsObserver) {
                    constraintsObserver.disconnect();
                }
                for (let i = 0; i < teamObservers.length; ++i) {
                    teamObservers[i].disconnect();
                }

                if (mutations.length !== 0 && $(mutations[mutations.length - 1].addedNodes)
                    .has(`h2:contains('${config.constraintsListName}')`).length === 1) {
                    self.setupBoard();
                }
            });

            let conf = {
                attributes: false,
                childList: true,
                characterData: false,
                subtree: false
            };
            trelloObserver.observe(jContent[0], conf);

            /*
             * Call setupBoard if this happens to be a Squadification board.
             */
            if (self.isSquadificationBoard()) {
                if (config.debug) {
                    console.log("Calling setup board");
                }
                self.setupBoard();
            }

            return trelloObserver;
        },

        /**
         * Setting up a squadification board.
         *  - Gets all labels and colors
         *  - Adds observers for constraints list and teams
         *  - Adds header icons
         *  - Does an initial runthrough parsing constraints and teams
         * This method is called when the extension is first loaded and when
         * a new board is loaded.
         */
        setupBoard() {
            let jCanvas = $("div.board-canvas");
            if (!jCanvas.length) {
                throw new ReferenceError("DIV.board-canvas not found");
            }

            if (config.debug) {
                console.info("Setting up board");
            }

            labelColors = tdom.getLabelColors();

            self.addConstraintsObserver(jCanvas);

            /*
             * Delay init of team observers to avoid double calls when first loading.
             */
            setTimeout(() => {
                self.addTeamObservers(jCanvas);
            }, 1000);

            self.addHeaderIcons();
            let jList = $("div.js-list-content").has(`h2:contains('${config.constraintsListName}')`);
            self.parseConstraints(jList);
            self.beautifyConstraintsList(jList);
            self.checkAllTeams(jCanvas);
        },

        /**
         * Checks if a squadification board seems to be loaded.
         * 
         * @returns {boolean} true if it is a sqaudification board otherwise fasle
         */
        isSquadificationBoard() {
            let jLists = $("div.js-list-content").has(`h2:contains('${config.constraintsListName}')`);
            return jLists.length === 1;
        },

        /**
         * Adds an observer for the constraints list. When this observer is triggered
         * constraints are parsed and subsequently all teams are checked, too.
         * 
         * @param {jQuery} jCanvas The current canvas
         */
        addConstraintsObserver(jCanvas) {
            let jList = $("div.js-list-content").has(`h2:contains('${config.constraintsListName}')`);
            if (!jList.length) {
                throw new ReferenceError(`List '${config.constraintsListName}' not found`);
            }
            if (!jCanvas) {
                throw new TypeError("Parameter 'jCanvas' not specified");
            }

            constraintsObserver = new MutationObserver(function () {
                self.parseConstraints(jList);
                self.beautifyConstraintsList(jList);
                self.checkAllTeams(jCanvas);
            });

            var conf = {
                attributes: false,
                childList: true,
                characterData: true,
                subtree: true
            };
            constraintsObserver.observe(jList[0], conf);
        },

        /**
         * Convenience method to get all lists that represent teams, i.e. all lists without an asterisk
         * and not the constraints list.
         * 
         * @returns {jQuery} jQuery object with list elements
         */
        getTeamLists() {
            let teamLists = tdom.getLists("", ["*", config.constraintsListName]);
            if (config.debug) {
                console.log(teamLists);
            }
            return teamLists;
        },

        /**
         * Adds observers for all team lists.
         * 
         * @see addConstraintsObserver()
         */
        addTeamObservers(jCanvas) {
            if (!jCanvas) {
                throw new TypeError("Parameter 'jCanvas' not specified");
            }

            teamObservers = [];
            /*
             * Add an observer for all lists except for ones containing an asterisk
             * and the constraints list.
             */
            self.getTeamLists().each(function () {
                if (config.debug) {
                    console.log("Adding observer for " + tdom.getListName(this));
                }
                teamObservers.push(self.addTeamObserver(this));
            });
        },

        /**
         * Adds an observer to a list's *DIV.js-list-cards* element and hooks it up
         * to the checkTeam method.
         * 
         * @param {Element} listEl The list
         * @returns {MutationObserver} The observer (not the newspaper)
         */
        addTeamObserver(listEl) {
            if (!listEl) {
                throw new TypeError("Parameter 'listEl' not specified");
            }

            var cardsEl = $(listEl).find("div.js-list-cards")[0];
            var listObserver = new MutationObserver(function (mutations) {
                console.warn("Team observer INVOKED");
                /*
                 * Ignore irrelevant changes.
                 * Attempting to skip recurring changes triggered by Trello, and only act
                 * on actual changes to teams.
                 */
                // TODO Optimize? Improve accuracy?
                if (mutations[0].target.className === "js-badges") {
                    return;
                }
                self.checkTeam(listEl);
            });
            var conf = {
                attributes: false,
                childList: true,
                characterData: true,
                subtree: true
            };
            listObserver.observe(cardsEl, conf);
            return listObserver;
        },

        /**
         * Adds header icons to the board.
         *  - **Fields** to toggle field visibility on and off
         *  - **Pics** to choose how cover images are displayed
         *  - **Stats** to toggle graphs on and off
         */
        addHeaderIcons() {
            // TODO Add some fancy pancy icons (how to use the ::before pseudoclass here?!?)
            $("div.header-user").prepend("<a id='toggle-stats' class='header-btn squad-enabled'>" +
                "<span style='visibility: hidden;' class='header-btn-icon icon-lg icon-organization light'></span>" +
                "<span class='header-btn-text'>Stats</span></a>");
            $("div.header-user").prepend("<a id='toggle-pics' class='header-btn squad-enabled'>" +
                "<span style='visibility: hidden;' class='header-btn-icon icon-lg icon-organization light'>" +
                "</span><span class='header-btn-text'>Pics</span></a>");
            $("div.header-user").prepend("<a id='toggle-fields' class='header-btn squad-enabled'>" +
                "<span style='visibility: hidden;' class='header-btn-icon icon-lg icon-organization light'></span>" +
                "<span class='header-btn-text'>Fields</span></a>");

            // TODO Refactor to separate functions for readability and testability

            $("a#toggle-stats").click(function () {
                $("div.graph-area").slideToggle("fast");
                $(this).toggleClass("squad-enabled squad-disabled");
            });

            $("a#toggle-pics").click(function () {
                if ($(this).hasClass("button-disabled")) {
                    return;
                }
                $(this).addClass("button-disabled");
                if (picSize === 1) {
                    $("div.list-card-cover").css("height", 0);
                    $(this).toggleClass("squad-tristate squad-disabled");
                    picSize = 0;
                } else if (picSize === 0) {
                    $("div.list-card-cover").filter(function () {
                        return $(this).css("background-image") !== "none";
                    }).each(function () {
                        var originalHeight = $(this).data("original-height");
                        $(this).css("height", originalHeight).css("background-size", "contain");
                    })

                    $(this).toggleClass("squad-disabled squad-enabled");
                    picSize = 2;
                } else {
                    tsqd.adjustCoverImages();
                    $(this).toggleClass("squad-enabled squad-tristate");
                    picSize = 1;
                }
                $(this).removeClass("button-disabled");
            });

            $("a#toggle-fields").click(function () {
                $("div.badges").slideToggle("fast");
                $(this).toggleClass("squad-enabled squad-disabled");
            });
        },

        /**
         * Parses constraints in the given list. It is assumed the provided list is
         * the *constraints list* for a squadification board.
         * 
         * @param {jQuery} jList The list to parse
         */
        parseConstraints(jList) {
            if (!jList) {
                throw new TypeError("Parameter [jList] not defined");
            }
            
            roleConstraints = tdom.countLabelsInList(jList);

            // TODO Refactor: A lot of repetitive code upinhere

            var minSizeCard = jList.find("span.list-card-title:contains('size >')");
            if (minSizeCard.length !== 0) {
                var text = minSizeCard
                    .clone() //clone the element
                    .children() //select all the children
                    .remove() //remove all the children
                    .end() //again go back to selected element
                    .text();
                if (text.indexOf(">=") !== -1) {
                    teamMinSize = parseInt(text.substring(text.indexOf(">=") + 2));
                    teamMinSize -= 1;
                } else {
                    teamMinSize = parseInt(text.substring(text.indexOf(">") + 1));
                }
                if (config.debug) {
                    console.log("Minimum team size (-1): " + teamMinSize);
                }
            } else {
                teamMinSize = undefined;
            }

            var maxSizeCard = jList.find("span.list-card-title:contains('size <')");
            if (maxSizeCard.length !== 0) {
                var text = maxSizeCard
                    .clone() //clone the element
                    .children() //select all the children
                    .remove() //remove all the children
                    .end() //again go back to selected element
                    .text();
                if (text.indexOf("<=") !== -1) {
                    teamMaxSize = parseInt(text.substring(text.indexOf("<=") + 2));
                    teamMaxSize += 1;
                } else {
                    teamMaxSize = parseInt(text.substring(text.indexOf("<") + 1));
                }
                if (config.debug) {
                    console.log("Maximum team size (+1): " + teamMaxSize);
                }
            } else {
                teamMaxSize = undefined;
            }

            var minConfidenceCard = jList.find("span.list-card-title:contains('confidence >')");
            if (minConfidenceCard.length !== 0) {
                var text = minConfidenceCard
                    .clone() //clone the element
                    .children() //select all the children
                    .remove() //remove all the children
                    .end() //again go back to selected element
                    .text();
                if (text.indexOf(">=") !== -1) {
                    minConfidence = parseInt(text.substring(text.indexOf(">=") + 2));
                    minConfidence -= 1;
                } else {
                    minConfidence = parseInt(text.substring(text.indexOf(">") + 1));
                }
                if (config.debug) {
                    console.log("Minimum confidence (-1): " + minConfidence);
                }
            } else {
                minConfidence = undefined;
            }
        },

        /**
         * This method makes the constraints list less obtrusive by making
         * it melt in to the background lending colors from the board color scheme.
         * 
         * @param {jQuery} jList The list to pretty-up
         */
        beautifyConstraintsList(jList) {
            if (!jList) {
                throw new TypeError("Parameter [jList] not defined");
            }
            
            jList.css("background-color", $("div#header").css("background-color"));
            jList.css("color", $("div#header").css("color"));
            var cardBg = $(".header-search-input").css("background-color");
            jList.find("a.list-card").css("background-color", cardBg).css(
                "border", "0px solid");
        },

        /**
         * Update visuals for all teams.
         * 
         * @see getTeamLists()
         */
        checkAllTeams() {
            self.getTeamLists().each(function () {
                self.checkTeam(this);
            })
        },

        /**
         * Checks if one team (i.e. one list) meets parsed constraints. Also checks
         * if there are any concern cards in the list and if team confidence is ok.
         * Then adds/updates the status bar at the top accordingly. Also updates card
         * colors and draws graphs.
         * 
         * @param {Element} listEl The list element
         */
        checkTeam(listEl) {
            if (!listEl) {
                throw new TypeError("Argument 'listEl' not defined");
            }

            let statusEl;
            let violationsEl;
            let teamRoles;
            let violations;
            let fields;
            let teamConfidence;

            statusEl = $(listEl).find("div.list-status");
            if (statusEl.length === 0) {
                $(listEl).prepend("<div class='list-status' style='background-color: #444444;'>" +
                    "<div class='team-count'>?</div><div class='violations'></div></div>");
                statusEl = $(listEl).find("div.list-status");
            }

            violationsEl = $(listEl).find("div.violations").empty();

            teamRoles = tdom.countLabelsInList(listEl);
            violations = self.isConstraintsMet(listEl, teamRoles);
            fields = self.getFields(listEl);
            teamConfidence = self.getTeamConfidence(fields["Confidence"]);

            statusEl.css("background-color", config.validTeamColor);

            if (violations.length > 0) {
                statusEl.css("background-color", config.invalidTeamColor);
                violationsEl.html(violations.join("<br/>"));
            } else {
                if (teamRoles["concern"] !== undefined) {
                    var concernCards = $(listEl).find("div.list-card-details:has(span.card-label):contains('concern')");
                    concernCards.css("background-color", "rgba(255,128,96,0.4)");
                    var cardTitles = concernCards.find("span.list-card-title");
                    cardTitles.each(function () {
                        var text = $(this)
                            .clone() //clone the element
                            .children() //select all the children
                            .remove() //remove all the children
                            .end() //again go back to selected element
                            .text();
                        violationsEl.append(text + "<br/>");
                    });
                    statusEl.css("background-color", config.unconfidentTeamColor);
                }
                if (minConfidence !== undefined && teamConfidence !== undefined && teamConfidence < minConfidence + 1) {
                    violationsEl.append("Low confidence score (" + teamConfidence.toFixed(1) + ")<br/>");
                    statusEl.css("background-color", config.unconfidentTeamColor);
                }
            }

            let teamMembers = $(listEl).find("div.list-card-details:has(span.card-label)").not(":contains('concern')").length;
            $(listEl).find("div.team-count").text(teamMembers);

            /*
             * Change color of cards without labels
             */
            $(listEl).find("div.list-card-details:not(:has(span.card-label))").css("background-color", "rgba(180,180,180,0.2)");

            self.drawTeamGraphs(listEl, fields);
        },

        /**
         * Expects an array with length 6 as input, e.g.
         * `[undefined,undefined,undefined,Array,Array,Array]`
         * where *undefined* indicates no member has that confidence level
         * and an array has different roles as keys, and number of
         * team members with that confident as value, e.g.
         * `["PO": 1, "Dev": 2]`
         * 
         * @param {Array} field Array with length 6
         * @returns {Number} Team avg confidence or *undefined* if field not used
         */
        getTeamConfidence(field) {
            if (field === undefined) {
                return undefined;
            }
            let ctot = 0;
            let mbrcnt = 0;
            for (let i = 1; i <= 5; ++i) {
                let f = field[i.toString()];
                if (f !== undefined) {
                    for (let r in f) {
                        if (f.hasOwnProperty(r)) {
                            ctot += i * f[r];
                            mbrcnt += f[r];
                        }
                    }
                }
            }
            return ctot / mbrcnt;
        },

        /**
         * Checks if constraints are met for a team.
         *  - Checks individual roles from constraints list
         *  - Checks number of team members
         * 
         * @param {listEl} listEl The team list
         * @param {Object} teamRoles Associative array with role count in team
         * @returns {Array} Array with violations if any otherwise an empty array
         */
        isConstraintsMet(listEl, teamRoles) {
            let violationList = [];
            /*
             * Check if the # of any roles in team is less than the constraint
             */
            for (let role in teamRoles) {
                if (roleConstraints[role] && roleConstraints[role] > teamRoles[role]) {
                    violationList.push(`Not enough ${role}s`);
                }
            }

            /*
             * Check if any prescribed role is missing.
             */
            for (let role in roleConstraints) {
                if (!teamRoles[role]) {
                    violationList.push("No " + role);
                }
            }

            let teamMembers = self.countTeamMembers(listEl);

            if (teamMinSize !== undefined && teamMembers <= teamMinSize) {
                violationList.push("Not enough members");
            } else if (teamMaxSize !== undefined && teamMembers >= teamMaxSize) {
                violationList.push("Too many members");
            }

            return violationList;
        },

        /**
         * Counts the team members in a team (i.e. list). All cards containing at
         * least one label (except concern cards) are assumed to be a real person :-)
         * 
         * @param {Element} listEl The team list
         * @returns {number} Number of members in team
         */
        countTeamMembers(listEl) {
            let teamMembers = $(listEl).find("div.list-card-details:has(span.card-label)")
                .not(":contains('concern')").length;
            if (config.debug) {
                console.log("# of team members in " +
                    tdom.getListName(listEl) + ": " +
                    teamMembers);
            }
            return teamMembers;
        },

        /**
         * Counts how many times each value for a field is used in the given list.
         * Iterates through the list and for each card with a label iterates through the
         * fields for that card building up an array like this:
         * ```
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
         * ```
         * 
         * @param {Element} listEl The list to get fields for
         * @returns {Object} An associative array as described above
         */
        getFields(listEl) {
            if (!listEl) {
                throw new TypeError("Argument 'listEl' not defined");
            }

            let fields = [];
            $(listEl).find("div.list-card-details").each(function () {
                // TODO Improve this: should only count team members - compare with "countTeamMembers" above
                let labels = tdom.getCardLabels(this);
                if (labels.length === 0) {
                    return;
                }
                let cardFields = tdom.getCardFields(this);
                for (let f in cardFields) {
                    if (fields[f] === undefined) {
                        fields[f] = [];
                    }
                    let fVal = cardFields[f];
                    if (fields[f][fVal] === undefined) {
                        fields[f][fVal] = [];
                    }
                    if (fields[f][fVal][labels[0]] === undefined) {
                        fields[f][fVal][labels[0]] = 0;
                    }
                    fields[f][fVal][labels[0]]++;
                }
            });
            return fields;
        },

        /**
         * Adjusts size of cover images.
         */
        adjustCoverImages() {
            $("div.list-card-cover").filter(function () {
                return $(this).css("background-image") !== "none";
            }).each(function () {
                $(this).data("original-height", $(this).css("height"));
                $(this).css("height", config.imageHeight)
                    .css("background-size", "contain")
                    .css("background-color", config.coverBgColor);
            })
        },

        /**
         * 
         */
        drawTeamGraphs(listEl, fields) {
            if (!listEl) {
                throw new TypeError("Parameter 'listEl' undefined");
            }
            if (!fields) {
                throw new TypeError("Parameter 'fields' undefined");
            }

            let jArea = $(listEl).find("div.graph-area");
            if (jArea.length === 0) {
                var listHeader = $(listEl).find("div.list-header");
                if (listHeader.length === 0) {
                    console.error("list-header not found");
                }
                listHeader.append("<div class='graph-area' style='background-color: rgba(0,0,0,0);'></div>");
                jArea = $(listHeader).find("div.graph-area");
            }

            self.drawRoleDistribution(jArea, listEl);

            for (var f in fields) {
                if (f === "Confidence") {
                    self.drawConfidence(jArea, f, fields[f]);
                } else {
                    self.drawGraph(jArea, f, fields[f]);
                }
            }
        },

        /**
         * 
         */
        drawRoleDistribution(jArea, listEl) {
            let labels = tdom.countListLabels(listEl, ["*", "concern"]);
            let graphLabels = self.sortKeys(labels);
            let chartLabels = [];
            let chart;
            let graphData = {
                backgroundColor: [],
                data: []
            };

            for (var i = 0; i < graphLabels.length; ++i) {
                graphData.data.push(labels[graphLabels[i]]);
                chartLabels.push(labels[graphLabels[i]]);
                graphData.backgroundColor.push(labelColors[graphLabels[i]]);
            }

            if (jArea.find("#graphdist").length === 0) {
                jArea.append("<canvas id='graphdist' width='100%' height='" + config.graphHeight + "px'></canvas>");
                var ctx = jArea.find("#graphdist")[0];
                ctx.style.backgroundColor = "rgba(255,255,255,0.25)";

                try {
                    chart = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: chartLabels,
                            datasets: [graphData]
                        },
                        options: {
                            legend: {
                                position: "left",
                                display: true,
                                labels: {
                                    boxWidth: 20
                                }
                            },
                            tooltips: {
                                enabled: true,
                            },
                            animation: {
                                duration: 0
                            }
                        }
                    });
                    jArea.data("graphdist", chart);
                } catch (e) {
                    console.error(e);
                }
            } else {
                chart = jArea.data("graphdist");
                chart.data = {
                    labels: chartLabels,
                    datasets: [graphData]
                };
                chart.update();
            }
        },

        /**
         * 
         */
        drawGraph(jArea, name, values) {
            if (!jArea) {
                throw new TypeError("Parameter [jArea] not defined");
            }
            if (!name) {
                throw new TypeError("Parameter [name] not defined");
            }
            if (!values) {
                throw new TypeError("Parameter [values] not defined");
            }
            let graphData = [];
            let labels = self.extractLabels(values);
            let chart;
            let graphLabels = self.sortKeys(values);

            for (var i = 0; i < labels.length; ++i) {
                var labelData = [];
                for (var j = 0; j < graphLabels.length; ++j) {
                    labelData.push(values[graphLabels[j]][labels[i]]);
                }
                graphData.push({
                    label: labels[i],
                    data: labelData,
                    backgroundColor: labelColors[labels[i]]
                });
            }

            var graphId = "#graph" + name;
            if (jArea.find(graphId).length === 0) {
                jArea.append("<canvas id='graph" + name + "' width='100%' height='" + config.graphHeight + "px'></canvas>");
                var ctx = jArea.find(graphId)[0];
                ctx.style.backgroundColor = 'rgba(255,255,255,0.25)';
                if (!ctx) {
                    throw new ReferenceError("Canvas for '" + graphId + "' not found");
                }
                try {
                    chart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: graphLabels,
                            datasets: graphData
                        },
                        options: {
                            legend: {
                                display: false,
                            },
                            scales: {
                                xAxes: [{
                                    stacked: true,
                                }],
                                yAxes: [{
                                    stacked: true,
                                    ticks: {
                                        beginAtZero: true
                                    }
                                }]
                            },
                            animation: {
                                duration: 0
                            }
                        }
                    });
                    jArea.data("graph" + name, chart);
                } catch (e) {
                    console.error(e);
                }
            } else {
                chart = jArea.data("graph" + name);
                chart.data = {
                    labels: graphLabels,
                    datasets: graphData
                };
                chart.options.animation.duration = 1000;
                chart.update();
            }
        },

        /**
         * 
         */
        drawConfidence(jArea, name, values) {
            var graphData = [];

            var labels = self.extractLabels(values);
            var chart;

            for (var i = 0; i < labels.length; ++i) {
                var labelData = [];
                for (var j = 1; j <= 5; ++j) {
                    var data;

                    data = values[j.toString()];
                    if (data) {
                        data = data[labels[i]];
                    }
                    if (data === undefined) {
                        data = 0;
                    }
                    labelData.push(data);
                }
                var lblCol = labelColors[labels[i]];
                graphData.push({
                    label: labels[i],
                    fill: false,
                    data: labelData,
                    backgroundColor: "rgba(" + lblCol.substring(4, lblCol.length - 1) + ",0.25)",
                    pointBackgroundColor: lblCol,
                    borderColor: lblCol
                });
            }

            var graphId = "#graph" + name;
            if (jArea.find(graphId).length === 0) {
                jArea.append("<canvas id='graph" + name + "' width='100%' height='" + config.graphHeight + "px'></canvas>");
                var ctx = jArea.find(graphId)[0];
                ctx.style.backgroundColor = 'rgba(255,255,255,0.25)';
                if (!ctx) {
                    console.error("Element ctx not defined");
                }
                try {
                    chart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: ["1", "2", "3", "4", "5"],
                            datasets: graphData
                        },
                        options: {
                            legend: {
                                display: false,
                            },
                            scales: {
                                yAxes: [{
                                    stacked: true,
                                    ticks: {
                                        beginAtZero: true
                                    }
                                }]
                            },
                            animation: {
                                duration: 0
                            }
                        }
                    });
                    jArea.data("graph" + name, chart);
                } catch (e) {
                    console.error(e);
                }
            } else {
                chart = jArea.data("graph" + name);
                chart.data = {
                    labels: ["1", "2", "3", "4", "5"],
                    datasets: graphData
                };
                chart.update();
            }
        },

        /**
         * Assuming an associative multi dimension array (an array where each element in turn
         * is an associative array) this function extracts the array element names from the inner
         * array. Any duplicates are removed.
         * 
         * @param {Array} data 2-dimension associative array
         */
        extractLabels(data) {
            var labels = [];
            for (var field in data) {
                for (var lbl in data[field]) {
                    if (labels.indexOf(lbl) === -1) {
                        labels.push(lbl);
                    }
                }
            }
            return labels;
        },

        /**
         * Returns an array with the given object's properties sorted alphabetically.
         * 
         * @param {Object} obj Object which properites to sort
         */
        sortKeys(obj) {
            var keys = [];
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    keys.push(key);
                }
            }
            return keys.sort();
        },

    }

    return self;
}));