// eslint-disable-next-line no-unused-vars
const tsqd = (function (factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], factory);
    } else {
        return factory(jQuery);
    }
}(function ($) {
    'use strict';

    let roleConstraints = []; // Role constraints, e.g. "BSA": 3
    // var constraintsListEl; // Element for list with constraints (a "js-list-content" class div)
    let constraintsObserver; // Mutation observer for constraints list
    let teamObservers = [];
    let labelColors;
    let teamMinSize;
    let teamMaxSize;
    let minConfidence;
    let picSize = 2; // Cover image size: 0=hide, 1=small (using imageHeight), 2=original

    let config = {

        constraintsListName: "Squadification Constraints",
        validTeamColor: "#86b623",
        unconfidentTeamColor: "#bb9922",
        invalidTeamColor: "#cc4400",
        graphLayout: {
            width: "100%",
            height: "96px",
            class: "list-graph",
            type: "bar",
            legend: {
                display: false,
                fontSize: 12,
                boxWidth: 10,
                position: "bottom",
            },
            animations: 0,
        },
        imageHeight: 64,
        coverBgColor: "#323232",

        debug: false,
    };

    const self = {

        get config() {
            return config;
        },

        set maxSize(size) {
            teamMaxSize = size;
        },

        set minSize(size) {
            teamMinSize = size;
        },

        set minimumConfidence(conf) {
            minConfidence = conf;
        },

        set roleConstraints(constraints) {
            roleConstraints = constraints;
        },

        /**
         * Sets the debug flag. The module will output messages to the console
         * when set to `true`.
         *
         * @param {boolean} debug `true` to spam console, otherwise `false`
         */
        set debug(debug) {
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
                subtree: false,
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

            self.extractLabelColors();

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
         * 
         */
        extractLabelColors() {
            labelColors = tdom.getLabelColors();
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

            let conf = {
                attributes: false,
                childList: true,
                characterData: true,
                subtree: true,
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
                    console.log(`Adding observer for ${tdom.getListName(this)}`);
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

            let cardsEl = $(listEl).find("div.js-list-cards")[0];
            let listObserver = new MutationObserver(function (mutations) {
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
            let conf = {
                attributes: false,
                childList: true,
                characterData: true,
                subtree: true,
            };
            listObserver.observe(cardsEl, conf);
            return listObserver;
        },

        // <span class='header-btn-text'>Stats</span>
        /**
         * Adds header icons to the board.
         *  - **Fields** to toggle field visibility on and off
         *  - **Pics** to choose how cover images are displayed
         *  - **Stats** to toggle graphs on and off
         */
        addHeaderIcons() {
            // TODO Add some fancy pancy icons (how to use the ::before pseudoclass here?!?)
            $("div.header-user").prepend("<a id='toggle-stats' class='header-btn squad-enabled'>" +
                "<span class='header-btn-text'>Stats</span></a>");
            $("div.header-user").prepend("<a id='toggle-pics' class='header-btn squad-enabled'>" +
                "</span><span class='header-btn-text'>Pics</span></a>");
            $("div.header-user").prepend("<a id='toggle-fields' class='header-btn squad-enabled'>" +
                "<span class='header-btn-text'>Fields</span></a>");
            $("div.header-user").prepend("<a id='group-stats' class='header-btn header-boards'>" +
                "<span class='header-btn-icon icon-lg icon-organization light'></span>" +
                "<span class='header-btn-text'>Group Overview</span></a>");

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
                        let originalHeight = $(this).data("original-height");
                        $(this).css("height", originalHeight).css("background-size", "contain");
                    });

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

            $("a#group-stats").click(function () {
                if ($("div.group-stats").is(":visible")) {
                    $("div.group-stats").slideUp(400);
                } else {
                    self.showGroupStats();
                }
            });
        },

        /**
         * 
         */
        showGroupStats() {
            let jGraphArea;
            let jStatWindow = $("div.group-stats");
            let jContent = $("div.window-overlay");

            if (jStatWindow.length === 0) {
                // let jSurface = $("div#surface");
                // jSurface.append("<div id='modal-overlay'></div>");
                // let jContent = $("div#board");
                jContent.append(
                    "<div class='group-stats'>" +
                    "<div class='group-stats-heading'>" +
                    "<span>Group Overview</span>" +
                    "<a id='close-group-stats' class='header-btn squad-disabled'>" +
                    "<span style='visibility: hidden;' class='header-btn-icon icon-lg icon-organization light'></span>" +
                    "<span class='header-btn-text'>Close</span>" +
                    "</a></div>" +
                    "<div id='group-stats-content'></div>" +
                    "</div>");
                jStatWindow = $("div.group-stats");
            }

            $("a#close-group-stats").click(function () {
                if ($("div.group-stats").is(":visible")) {
                    // $("div.window-overlay").hide(0);
                    jContent.removeClass("window-up");
                    $("body").removeClass("window-up");
                    $("div.group-stats").slideUp(400);
                }
            });

            jGraphArea = $("div#group-stats-content");
            jGraphArea.empty();

            let fields = self.getFields("", ["*", config.constraintsListName]);

            let layout = {
                type: "doughnut",
                width: "25vw",
                height: "70vh",
                class: "big-graph",
                legend: {
                    display: true,
                    labels: {
                        fontSize: 18,
                        boxWidth: 40,
                    },
                    position: "top",
                },
                animations: 1000,
                title: {
                    fontSize: 14,
                    padding: 20,
                },
            };

            let chartInfo = self.generateRoleDistribution(self.getTeamLists(), false, layout);
            self.drawGraph(jGraphArea, chartInfo);

            for (let f in fields) {
                let chartInfo = self.generateFieldGraphData(f, fields[f], {
                    width: "25vw",
                    height: "22vh",
                    class: "big-graph",
                    legend: false,
                    animations: 1000,
                    title: {
                        fontSize: 14,
                        padding: 20,
                    },
                });
                self.drawGraph(jGraphArea, chartInfo);
            }

            $("body").addClass("window-up");
            jContent.addClass("window-up");
            jStatWindow.slideDown(400);
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

            let minSizeCard = jList.find("span.list-card-title:contains('size >')");
            if (minSizeCard.length !== 0) {
                let text = minSizeCard
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
            } else {
                teamMinSize = undefined;
            }

            let maxSizeCard = jList.find("span.list-card-title:contains('size <')");
            if (maxSizeCard.length !== 0) {
                let text = maxSizeCard
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
            } else {
                teamMaxSize = undefined;
            }

            let minConfidenceCard = jList.find("span.list-card-title:contains('confidence >')");
            if (minConfidenceCard.length !== 0) {
                let text = minConfidenceCard
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
            let cardBg = $(".header-search-input").css("background-color");
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
            });
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
            let teamSize;

            statusEl = $(listEl).find("div.list-status");
            if (statusEl.length === 0) {
                $(listEl).prepend("<div class='list-status' style='background-color: #444444;'>" +
                    "<div class='team-count'>?</div><div class='violations'></div></div>");
                statusEl = $(listEl).find("div.list-status");
            }

            violationsEl = $(listEl).find("div.violations").empty();

            teamRoles = tdom.countLabelsInList(listEl);
            teamSize = self.countTeamMembers(listEl);
            violations = self.isConstraintsMet(teamSize, teamRoles);
            fields = self.getFields(tdom.getListName(listEl));
            teamConfidence = self.getTeamConfidence(fields["Confidence"]);

            statusEl.css("background-color", config.validTeamColor);

            if (violations.length > 0) {
                statusEl.css("background-color", config.invalidTeamColor);
                violationsEl.html(violations.join("<br/>"));
            } else {
                if (teamRoles["concern"] !== undefined) {
                    let concernCards = $(listEl).find("div.list-card-details:has(span.card-label):contains('concern')");
                    concernCards.css("background-color", "rgba(255,128,96,0.4)");
                    let cardTitles = concernCards.find("span.list-card-title");
                    cardTitles.each(function () {
                        let text = $(this)
                            .clone() //clone the element
                            .children() //select all the children
                            .remove() //remove all the children
                            .end() //again go back to selected element
                            .text();
                        violationsEl.append(`${text}<br/>`);
                    });
                    statusEl.css("background-color", config.unconfidentTeamColor);
                }
                if (minConfidence !== undefined && teamConfidence !== undefined && teamConfidence < minConfidence + 1) {
                    violationsEl.append(`Low confidence score (${teamConfidence.toFixed(1)})<br/>`);
                    statusEl.css("background-color", config.unconfidentTeamColor);
                }
            }

            /*
             * Update the team member count.
             */
            $(listEl).find("div.team-count").text(teamSize);

            /*
             * Change color of cards without labels
             */
            $(listEl).find("div.list-card-details:not(:has(span.card-label))").css(
                "background-color", "rgba(180,180,180,0.2)");

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
         * @param {number} teamSize Number of people in team
         * @param {Object} teamRoles Associative array with role count in team
         * @returns {Array} Array with violations if any otherwise an empty array
         */
        isConstraintsMet(teamSize, teamRoles) {
            let violations = [];

            violations = self.checkTeamRoles(teamRoles);
            violations = violations.concat(self.checkTeamSize(teamSize));

            return violations;
        },

        /**
         * Checks if the team has the roles as defined by the constraints list.
         * ?
         * @param {Object} teamRoles Assoc array with team role count
         * @returns {Array} List with violations
         */
        checkTeamRoles(teamRoles) {
            let violations = [];

            /*
             * Check if the # of any roles in team is less than the constraint
             */
            for (let role in teamRoles) {
                if (roleConstraints[role] && teamRoles[role] &&
                    roleConstraints[role] > teamRoles[role]) {
                    violations.push(`Not enough ${role}s`);
                }
            }

            /*
             * Check if any prescribed role is missing.
             */
            for (let role in roleConstraints) {
                if (!teamRoles[role]) {
                    violations.push(`No ${role}`);
                }
            }

            return violations;
        },

        /**
         * Checks if the team has the mandated minimum/maximum members.
         *
         * @param {number} teamSize Number of people in team
         * @returns {Array} List with violations
         */
        checkTeamSize(teamSize) {
            let violations = [];

            if (teamMinSize !== undefined && teamSize <= teamMinSize) {
                violations.push("Not enough members");
            } else if (teamMaxSize !== undefined && teamSize >= teamMaxSize) {
                violations.push("Too many members");
            }

            return violations;
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
         * @param {String} name Name of lists to get fields for
         * @param {Array} filter Optional filter with lists to exclude, e.g. `['*','Constraints']`
         * @returns {Object} An associative array as described above
         * @see getCardFields 
         */
        getFields(name, filter) {
            let jLists = tdom.getLists(name, filter);
            let fields = [];

            for (let i = 0; i < jLists.length; ++i) {
                $(jLists[i]).find("div.list-card-details").each(function () {
                    fields = self.getCardFields(this, fields);
                });
            }

            return fields;
        },

        /**
         * 
         */
        getCardFields(cardEl, fields = []) {
            if (!cardEl) {
                throw new TypeError("Parameter [cardEl] missing");
            }

            let labels = tdom.getCardLabels(cardEl);
            if (labels.length === 0) {
                return fields;
            }
            let cardFields = tdom.getCardFields(cardEl);
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
            });
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

            /*
             * Create the graph area if it does not exist
             */
            let jArea = $(listEl).find("div.graph-area");
            if (jArea.length === 0) {
                let listHeader = $(listEl).find("div.list-header");
                if (listHeader.length === 0) {
                    console.error("list-header not found");
                }
                listHeader.append("<div class='graph-area' style='background-color: rgba(0,0,0,0);'></div>");
                jArea = $(listHeader).find("div.graph-area");
            }

            let chartInfo = self.generateRoleDistribution($(listEl));
            self.drawGraph(jArea, chartInfo);

            for (let f in fields) {
                let chartInfo;
                if (f === "Confidence") {
                    chartInfo = self.generateConfidenceData(fields[f]);
                } else {
                    chartInfo = self.generateFieldGraphData(f, fields[f]);
                }
                self.drawGraph(jArea, chartInfo);
            }
        },

        /**
         * 
         */
        generateRoleDistribution(jLists, showCountAsLabel = true, layout) {
            let badges = tdom.countListLabels(jLists, ["*", "concern"]);
            let labels = self.sortKeys(badges);
            let chartLabels = [];
            let graphData = {
                backgroundColor: [],
                data: [],
            };

            for (let i = 0; i < labels.length; ++i) {
                graphData.data.push(badges[labels[i]]);
                if (showCountAsLabel) {
                    chartLabels.push(badges[labels[i]]);
                } else {
                    chartLabels.push(labels[i]);
                }
                graphData.backgroundColor.push(labelColors[labels[i]]);
            }

            let chartInfo = {
                name: "dist",
                labels: chartLabels,
                data: [graphData],
                layout: layout || {
                    type: "doughnut",
                    width: "100%",
                    height: "96px",
                    class: "list-graph",
                    legend: {
                        display: true,
                        labels: {
                            fontSize: 12,
                            boxWidth: 15,
                        },
                        position: "left",
                    },
                    animations: 0,
                },
            };

            return chartInfo;
        },

        /**
         * 
         */
        generateFieldGraphData(name, field, layout = config.graphLayout) {
            let data = []; // Chart data
            let badges = self.extractLabels(field); // The labels/badges from Trello
            let labels = self.sortKeys(field); // The labels to display in the chart

            for (let i = 0; i < badges.length; ++i) {
                let badgeData = [];
                for (let j = 0; j < labels.length; ++j) {
                    badgeData.push(field[labels[j]][badges[i]]);
                }
                data.push({
                    label: badges[i],
                    data: badgeData,
                    backgroundColor: labelColors[badges[i]],
                });
            }

            let chartInfo = {
                name,
                labels,
                data,
                layout,
            };

            return chartInfo;
        },

        generateConfidenceData(field, layout = config.graphLayout) {
            let graphData = [];

            let labels = self.extractLabels(field);

            for (let i = 0; i < labels.length; ++i) {
                let labelData = [];
                for (let j = 1; j <= 5; ++j) {
                    let data;

                    data = field[j.toString()];
                    if (data) {
                        data = data[labels[i]];
                    }
                    if (data === undefined) {
                        data = 0;
                    }
                    labelData.push(data);
                }
                let lblCol = labelColors[labels[i]];
                graphData.push({
                    label: labels[i],
                    fill: false,
                    data: labelData,
                    backgroundColor: `rgba(${lblCol.substring(4, lblCol.length - 1)},0.25)`,
                    pointBackgroundColor: lblCol,
                    borderColor: lblCol,
                });
            }

            let lineLayout = Object.assign({}, layout);
            lineLayout.type = "line";

            let chartInfo = {
                name: "Confidence",
                labels: ["1", "2", "3", "4", "5"],
                responsive: true,
                type: 'line',
                data: graphData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    legend: {
                        display: false,
                    },
                    scales: {
                        yAxes: [{
                            stacked: true,
                            ticks: {
                                beginAtZero: true,
                                stepSize: 1,
                            },
                        }],
                    },
                    animation: {
                        duration: 0,
                    },
                },
                layout: lineLayout,
            };

            return chartInfo;
        },

        /**
         * Draws a graph in the given area. *chartInfo* is expected to be an object with like this:
         * ```
         * chartInfo = {
         *   "name": "identifier",
         *   "labels": ["lbl1","lbl2",...],
         *   "data": {...},
         *   "layout": {...},
         * }
         * ```
         * @param {jQuery} jArea The area where graph is added
         * @param {Object} chartInfo Information about the graph to draw
         */
        drawGraph(jArea, chartInfo) {

            // TODO Add labels to the donut chart

            if (!jArea) {
                throw new TypeError("Parameter [jArea] not defined");
            }
            if (!chartInfo) {
                throw new TypeError("Parameter [chartInfo] not defined");
            }

            let chart;
            let {
                layout,
            } = chartInfo;
            let graphId = `#graph${chartInfo.name}`;

            // ? No reason why jArea.data attribute should be undefined here (only happens when testing)
            if (jArea.find(graphId).length === 0 || jArea.data(`graph${chartInfo.name}`) === undefined) {
                jArea.append(`<div class='${layout.class}' ` +
                    `style='position: relative; width: ${layout.width} !important; height: ${layout.height} !important;'>` +
                    `<canvas id='graph${chartInfo.name}'></canvas></div>`);
                let ctx = jArea.find(graphId)[0];
                ctx.style.backgroundColor = 'rgba(255,255,255,0.0)';


                try {
                    chart = new Chart(ctx, {
                        type: layout.type || "bar",
                        data: {
                            labels: chartInfo.labels,
                            datasets: chartInfo.data,
                        },
                        options: chartInfo.options || {
                            responsive: true,
                            maintainAspectRatio: false,
                            legend: layout.legend,
                            title: {
                                display: layout.title !== undefined,
                                text: chartInfo.name,
                                fontSize: layout.title ? layout.title.fontSize : 0,
                                padding: layout.title ? layout.title.padding : 0,
                            },
                            scales: layout.type !== "bar" ? {
                                "yAxes": [],
                                "xAxes": [],
                            } : {
                                xAxes: [{
                                    stacked: true,
                                }],
                                yAxes: [{
                                    stacked: true,
                                    ticks: {
                                        beginAtZero: true,
                                        min: 0,
                                        callback: function (value) {
                                            if (Math.floor(value) === value) {
                                                return value;
                                            }
                                        },
                                    },
                                }],
                            },
                            animation: {
                                duration: layout.animations,
                            },
                        },
                    });
                    jArea.data(`graph${chartInfo.name}`, chart);
                } catch (e) {
                    console.error(e);
                }
            } else {
                chart = jArea.data(`graph${chartInfo.name}`);
                chart.data = {
                    labels: chartInfo.labels,
                    datasets: chartInfo.data,
                };
                chart.options.animation.duration = layout.animations;
                chart.update();
            }

            // HACK Used for testing - would like to spy on this instead
            return chart;
        },

        /**
         * Assuming an associative multi dimension array (an array where each element in turn
         * is an associative array) this function extracts the array element names from the inner
         * array. Any duplicates are removed.
         *
         * @param {Array} data 2-dimension associative array
         */
        extractLabels(data) {
            let labels = [];
            for (let field in data) {
                for (let lbl in data[field]) {
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
            let keys = [];
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    keys.push(key);
                }
            }
            return keys.sort();
        },

    };

    return self;
}));