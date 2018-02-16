
/* global $ */
/* global Chart */

//#region GLOBAL DEFINITIONS

/*
 * Global variables
 */
var roleConstraints = [];       // Role constraints, e.g. "BSA": 3
var constraintsListEl;          // Element for list with constraints (a "js-list-content" class div)
var boardCanvasEl;              // Element for list with board canvas (a "board-canvas" class div)
var constraintsObserver;        // Mutation observer for constraints list
var teamObservers = [];
var labelColors = [];
var teamMinSize;
var teamMaxSize;
var minConfidence;
var picSize = 2;                // Cover image size: 0=hide, 1=small (using imageHeight), 2=original

var config = {

    validTeamColor: "#96c623",
    unconfidentTeamColor: "#bb9922",
    invalidTeamColor: "#cc4400",

    imageHeight: 64,
    graphHeight: 32,
    coverBgColor: "#323232"
}

// #endregion

console.info("Running SQUADIFICATION Chrome extension");

if ($("div.board-canvas").has("h2:contains('Squadification Constraints')").length === 1) {
    console.log("Setting up board");
    setupBoard();
}

var contentEl = $("div#content");
if (contentEl.length !== 1)  {
    console.error("No content div found");
} else {
    var trelloObserver = new MutationObserver(function(mutations) {
        if (mutations.length !== 0 && $(mutations[mutations.length - 1].addedNodes).has("h2:contains('Squadification Constraints')").length === 1) {
            console.log("SQUADIFICATION TIME!!!");
            setupBoard();
        }
    });
    var conf = {attributes: false, childList: true, characterData: false, subtree: false};
    trelloObserver.observe(contentEl[0], conf); 
}

function setupBoard() {
    boardCanvasEl = document.querySelector("div.board-canvas");
    if (!boardCanvasEl) {
        console.error("Did not find board-canvas div");
        return;
    }

    constraintsListEl = $("div.js-list-content").has("h2:contains('Squadification Constraints')");
    beautifyConstraintsList(constraintsListEl);
    parseConstraints(constraintsListEl);
    // checkAllTeams(boardCanvasEl);

    addConstraintsObserver(constraintsListEl, boardCanvasEl);
    addTeamObservers(boardCanvasEl, teamObservers);

    addHeaderIcons();
    addListFolding();
    
    /**
     * Extract label colors from board
     */
    labelColors = [];
    $("div.board-canvas").find("span.card-label").each(function() {
        var title = $(this).attr("title");
        var bgCol = $(this).css("backgroundColor");
        labelColors[title] = bgCol;
    });

    $("div.list-card-cover").filter(function() {
        return $(this).css("background-image") !== "none";
    }).each(function() {
        var originalHeight = $(this).data("original-height");
        $(this).css("height", originalHeight).css("background-color", config.coverBgColor);
    });
}

function adjustCoverImages() {
    $("div.list-card-cover").filter(function() {
        return $(this).css("background-image") !== "none";
    }).each(function() {
        $(this).data("original-height", $(this).css("height"));
        $(this).css("height", config.imageHeight).css("background-size", "contain").css("background-color", config.coverBgColor);
    })
}

function addHeaderIcons() {
    // TODO Add some fancy pancy icons (how to use the ::before pseudoclass here?!?)
    $("div.header-user").prepend("<a id='toggle-stats' class='header-btn squad-enabled'><span style='visibility: hidden;' class='header-btn-icon icon-lg icon-organization light'></span><span class='header-btn-text'>Stats</span></a>");
    $("div.header-user").prepend("<a id='toggle-pics' class='header-btn squad-enabled'><span style='visibility: hidden;' class='header-btn-icon icon-lg icon-organization light'></span><span class='header-btn-text'>Pics</span></a>");
    $("div.header-user").prepend("<a id='toggle-fields' class='header-btn squad-enabled'><span style='visibility: hidden;' class='header-btn-icon icon-lg icon-organization light'></span><span class='header-btn-text'>Fields</span></a>");

    $("a#toggle-stats").click(function() {
        $("div.graph-area").slideToggle("fast");
        $(this).toggleClass("squad-enabled squad-disabled");
    });

    $("a#toggle-pics").click(function() {
        if ($(this).hasClass("button-disabled")) {
            return;
        }
        $(this).addClass("button-disabled");
        if (picSize === 1) {
            $("div.list-card-cover").css("height", 0);
            $(this).toggleClass("squad-tristate squad-disabled");
            picSize = 0;
        } else if (picSize === 0) {
            $("div.list-card-cover").filter(function() {
                return $(this).css("background-image") !== "none";
            }).each(function() {
                var originalHeight = $(this).data("original-height");
                $(this).css("height", originalHeight).css("background-size", "contain");
            })

            $(this).toggleClass("squad-disabled squad-enabled");        
            picSize = 2;
        } else {
            adjustCoverImages();      
            $(this).toggleClass("squad-enabled squad-tristate");
            picSize = 1;
        }
        $(this).removeClass("button-disabled");
    });

    $("a#toggle-fields").click(function() {
        $("div.badges").slideToggle("fast");
        $(this).toggleClass("squad-enabled squad-disabled");
    });
}

function addListFolding() {
    // TODO Slide list left hide its content etc.
    // $("div.list").prepend("<div class='fold-button'>-</div>");
    // $("div.fold-button").click(function() {
    //     $(this).parent().toggle("size", {
    //             to: {
    //                 width: 20,
    //             }}, 1000);
    // });
}

//#region OBSERVERS

function addConstraintsObserver(cEl, bEl) {
    if (!cEl) {
        console.error("Constraints list element undefined:");
        return;
    }
    if (!bEl) {
        console.error("Board canvas element undefined:");
        return;
    }
    constraintsObserver = new MutationObserver(function() {
        console.log("Constraints changed");
        parseConstraints(cEl);
        beautifyConstraintsList(cEl);
        checkAllTeams(bEl);
    });
    var conf = {attributes: false, childList: true, characterData: true, subtree: true};
    constraintsObserver.observe(cEl[0], conf);
}

function addTeamObservers(el, oList) {
    if (!el) {
        console.error("Board canvas undefined");
        return;
    }
    $(el).find("div.js-list-content").each(function() {
       addTeamObserver(this, oList);
    });
}

/**
 * Adds a mutation observer for a specific list on the board.
 * 
 * @param {Element} el List element
 * @param {Array} oList Array with observer objects
 */
function addTeamObserver(el, oList) {
    if (!el) {
        console.error("Element not defined");
        return;
    }
    var cardsEl = $(el).find("div.js-list-cards")[0];
    var listName = getListName(el);
    if (listName === "Squadification Constraints") {
        console.info("Skipping list: Squadification Constraints");
        return;
    }
    var listObserver = new MutationObserver(function(mutations) {
        /*
         * Ignore irrelevant changes.
         * Attempting to skip recurring changes triggered by Trello, and only act
         * on actual changes to teams.
         */
        // TODO Optimize? Improve accuracy?
        if (mutations[0].target.className === "js-badges") {
            // console.log("Skipping " + mutations[0].target.className);
            return;
        }
        checkTeam(el);
    });
    var conf = {attributes: false, childList: true, characterData: true, subtree: true};
    listObserver.observe(cardsEl, conf);
    oList.push(listObserver);
}

//#endregion

/**
 * Gets the name of a list.
 * 
 * @param {Element} el 
 * @returns {String} Name of list
 */
function getListName(el) {
    if (!el) {
        console.error("Element not defined");
        return;
    }
    var nameElement = $(el).find("h2.js-list-name-assist");
    if (nameElement.length === 0) {
        console.error('H2 tag not found');
        return null;
    }
    return nameElement.text();
}

//#region Graph Functionality

function drawTeamGraphs(el, fields) {
    if (!fields) {
        console.error("Parameter 'fields' undefined");
    }
    var area = $(el).find("div.graph-area");
    if (area.length === 0) {
        var listHeader = $(el).find("div.list-header");
        if (listHeader.length === 0) {
            console.error("list-header not found");
        }
        listHeader.append("<div class='graph-area' style='background-color: rgba(0,0,0,0);'></div>"); 
        area = $(listHeader).find("div.graph-area"); 
    }

    drawRoleDistribution(area, el);

    for(var f in fields) {
        console.log(f);
        if (f === "Confidence") {
            drawConfidence(area, f, fields[f]);
        } else {
            drawGraph(area, f, fields[f]);
        }
    }
}

function drawRoleDistribution(area, el) {
    var labels = getCardLabels(el, true);
    var graphLabels = sortKeys(labels);
    var chartLabels = [];
    var chart;
    var graphData = {};

    var graphData = {
        backgroundColor: [],
        data: []
    };

    for (var i = 0; i < graphLabels.length; ++i) {
        graphData.data.push(labels[graphLabels[i]]);
        chartLabels.push(labels[graphLabels[i]]);
        graphData.backgroundColor.push(labelColors[graphLabels[i]]);
    }

    if (area.find("#graphdist").length === 0) {
        area.append("<canvas id='graphdist' width='100%' height='" + config.graphHeight + "px'></canvas>");
        var ctx = area.find("#graphdist")[0];
        ctx.style.backgroundColor = "rgba(255,255,255,0.25)";

        console.log(graphLabels);
        console.log(graphData);

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
            area.data("graphdist", chart);
        } catch(e) {
            console.error(e);
        }
    } else {
        chart = area.data("graphdist");
        chart.data = {
            labels: chartLabels,
            datasets: [graphData]
        };
        chart.update();
    }
}

function drawGraph(area, name, d) {

    // console.info(d);
    // var graphLabels = [];
    var graphData = [];

    var labels = extractLabels(d);
    var chart;

    // Sort the labels. Sort of.
    var graphLabels = sortKeys(d);

    // First loop create labels and datasets arrays
    // for (var i = 0; i < keys.length; ++i) {
    // // for (var i in d) {
    //     graphLabels.push(keys[i);
    //     // graphData.push({data: null, backgroundColor: bg[col++]});
    // }
    // Second loop fill data
    for (var i = 0; i < labels.length; ++i) {
        var labelData = [];
        for (var j = 0; j < graphLabels.length; ++j) {
        // for (var j in d) {
            labelData.push(d[graphLabels[j]][labels[i]]);
        }
        graphData.push({label: labels[i], data: labelData, backgroundColor: labelColors[labels[i]]});
    }

    var graphId = "#graph" + name;
    if (area.find(graphId).length === 0) {
        console.log("CREATING CHART");
        area.append("<canvas id='graph" + name + "' width='100%' height='" + config.graphHeight + "px'></canvas>");
        var ctx = area.find(graphId)[0];
        ctx.style.backgroundColor = 'rgba(255,255,255,0.25)';
        if (!ctx) {
            console.error("Element ctx not defined");
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
            area.data("graph" + name, chart);
        } catch(e) {
            console.error(e);
        }
    } else {
        console.log("UPDATING CHART");
        chart = area.data("graph" + name);
        chart.data = {
            labels: graphLabels,
            datasets: graphData
        };
        chart.options.animation.duration = 1000;
        chart.update();
    }
}

function drawConfidence(area, name, d) {
    var graphData = [];

    var labels = extractLabels(d);
    var chart;

    // Sort the labels. Sort of.
    var graphLabels = sortKeys(d);

    for (var i = 0; i < labels.length; ++i) {
        var labelData = [];
        for (var j = 1; j <= 5; ++j) {
            var data;

            data = d[j.toString()];
            if (data) {
                data = data[labels[i]];
            }
            if (data === undefined) {
                data = 0;
            }
            labelData.push(data);
        }
        var lblCol = labelColors[labels[i]];
        graphData.push({label: labels[i],
            fill: false,
            data: labelData,
            backgroundColor: "rgba(" + lblCol.substring(4, lblCol.length - 1) + ",0.25)",
            pointBackgroundColor: lblCol,
            borderColor: lblCol
        });
    }

    var graphId = "#graph" + name;
    if (area.find(graphId).length === 0) {
        area.append("<canvas id='graph" + name + "' width='100%' height='" + config.graphHeight + "px'></canvas>");
        var ctx = area.find(graphId)[0];
        ctx.style.backgroundColor = 'rgba(255,255,255,0.25)';
        if (!ctx) {
            console.error("Element ctx not defined");
        }
        try {
            chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ["1","2","3","4","5"],
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
            area.data("graph" + name, chart);
        } catch(e) {
            console.error(e);
        }
    } else {
        chart = area.data("graph" + name);
        chart.data = {
            labels: ["1","2","3","4","5"],
            datasets: graphData
        };
        chart.update();
    }
}

/**
 * Assuming an associative multi dimension array (an array where each element in turn
 * is an associative array) this function extracts the array element names from the inner
 * array. Any duplicates are removed.
 * 
 * @param {Array} data 2-dimension associative array
 */
function extractLabels(data) {
    var labels = [];
    for(var field in data) {
        for (var lbl in data[field]) {
            if (labels.indexOf(lbl) === -1) {
                labels.push(lbl);
            }
        }
    }
    return labels;
}

function sortKeys(obj) {
    var keys = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    return keys.sort();
}

//#endregion

/**
 * Populates the _roleConstraints_ array from the Constraints list.
 * 
 * @param {Element} el The js-list-content element for the Constraints list
 */
function parseConstraints(el) {
    roleConstraints = getCardLabels(el);
    var minSizeCard = el.find("span.list-card-title:contains('size >')");
    if (minSizeCard.length !== 0) {
        var text = minSizeCard
                            .clone()    //clone the element
                            .children() //select all the children
                            .remove()   //remove all the children
                            .end()  //again go back to selected element
                            .text();
        if (text.indexOf(">=") !== -1) {
            teamMinSize = parseInt(text.substring(text.indexOf(">=")+2));
            teamMinSize -= 1;
        } else {
            teamMinSize = parseInt(text.substring(text.indexOf(">")+1));
        }
        console.log("Minimum team size: " + teamMinSize);
    } else {
        teamMinSize = undefined;
    }

    var maxSizeCard = el.find("span.list-card-title:contains('size <')");
    if (maxSizeCard.length !== 0) {
        var text = maxSizeCard
                            .clone()    //clone the element
                            .children() //select all the children
                            .remove()   //remove all the children
                            .end()  //again go back to selected element
                            .text();
        if (text.indexOf(">=") !== -1) {
            teamMaxSize = parseInt(text.substring(text.indexOf("<=")+2));
            teamMaxSize += 1;
        } else {
            teamMaxSize = parseInt(text.substring(text.indexOf("<")+1));
        }
        console.log("Maximum team size: " + teamMaxSize);
    } else {
        teamMaxSize = undefined;
    }

    var minConfidenceCard = el.find("span.list-card-title:contains('confidence >')");
    if (minConfidenceCard.length !== 0) {
        var text = minConfidenceCard
                            .clone()    //clone the element
                            .children() //select all the children
                            .remove()   //remove all the children
                            .end()  //again go back to selected element
                            .text();
        if (text.indexOf(">=") !== -1) {
            minConfidence = parseInt(text.substring(text.indexOf(">=")+2));
            minConfidence -= 1;
        } else {
            minConfidence = parseInt(text.substring(text.indexOf(">")+1));
        }
        console.log("Minimum confidence: " + minConfidence);
    } else {
        minConfidence = undefined;
    }
}

/**
 * Changes look and feel of constraints list to make it less obstrusive
 * and to differentiate it from the team lists.
 * 
 * @param {Element} el 
 */
function beautifyConstraintsList(el) {
    el.css("background-color", $("div#header").css("background-color"));
    el.css("color", $("div#header").css("color"));
    var cardBg = $(".header-search-input").css("background-color");
    console.log(cardBg);
    el.find("a.list-card").css("background-color", cardBg).css(
                    "border", "0px solid");
}

/**
 * Iterates all lists except the _Constraints_ list and checks if the list
 * meets the constraints from the _Constraints_ list.
 * 
 * @param {Element} el Board canvas element (div with "board-canvas" class) 
 */
function checkAllTeams(el) {
    if (!el) {
        console.error("Board canvas undefined");
        return;
    }
    $(el).find("div.js-list-content").each(function() {
        // var name = getListName(this);
        // teams.push(createTeam(name));
        checkTeam(this);
    });
}

/**
 * Check an individual list to see if it meet constraints.
 * 
 * @param {Element} The _js-list-content_ div for the list
 */
function checkTeam(el) {
    if(!el) {
        console.error("List undefined");
        return;
    }
    if (isListName(el, "Squadification Constraints") || isListName(el, "*")) {
        return;
    }

    if ($(el).find("div.list-status").length === 0) {
        $(el).prepend("<div class='list-status' style='background-color: #444444;'><div class='team-count'>7</div><div class='violations'></div></div>"); 
    }

    var statusEl = $(el).find("div.list-status");
    var violationsEl = $(el).find("div.violations");
    violationsEl.empty();
    var teamRoles = getCardLabels(el);
    var violations = isConstraintsMet(el, teamRoles);
    var fields = getFields(el);
    var teamConfidence = getTeamConfidence(fields["Confidence"]);

    statusEl.css("background-color", config.validTeamColor);

    if (violations.length > 0) {
        statusEl.css("background-color", config.invalidTeamColor);
        violationsEl.html(violations.join("<br/>"));
    } else {
        if (teamRoles["concern"] !== undefined) {
            var concernCards = $(el).find("div.list-card-details:has(span.card-label):contains('concern')");
            concernCards.css("background-color", "rgba(255,128,96,0.4)");
            var cardTitles = concernCards.find("span.list-card-title");
            cardTitles.each(function() {
                var text = $(this)
                        .clone()    //clone the element
                        .children() //select all the children
                        .remove()   //remove all the children
                        .end()  //again go back to selected element
                        .text();            
                violationsEl.append(text + "<br/>");
            });
            statusEl.css("background-color", config.unconfidentTeamColor);
        }
        console.log("Minimum confidence=" + minConfidence + ",teamConfidence=" + teamConfidence);
        if (minConfidence !== undefined && teamConfidence !== undefined && teamConfidence <= minConfidence + 1) {
            violationsEl.append("Low confidence score (" + teamConfidence.toFixed(1) + ")<br/>");
            statusEl.css("background-color", config.unconfidentTeamColor);
        }
    }

    var teamMembers = $(el).find("div.list-card-details:has(span.card-label)").not(":contains('concern')").length;
    $(el).find("div.team-count").text(teamMembers);

    /*
     * Change color of cards without labels
     */
    $(el).find("div.list-card-details:not(:has(span.card-label))").css("background-color", "rgba(180,180,180,0.2)");

    drawTeamGraphs(el, fields);
}

function getFields(el) {
    if (!el) {
        console.error("List element undefined");
        return;
    }
    var fields = [];
    $(el).find("div.list-card-details").each(function() {
        var label = getCardLabel(this);
        if (label === null) {
            console.warn("Card had no label - skipping");
            return;
        }
        var cardFields = getCardFields(this);
        for (var f in cardFields) {
            if (fields[f] === undefined) {
                fields[f] = [];
            }
            var fVal = cardFields[f];
            if (fields[f][fVal] === undefined) {
                fields[f][fVal] = [];
            }
            if (fields[f][fVal][label] === undefined) {
                fields[f][fVal][label] = 0;
            }
            fields[f][fVal][label]++;
        }
    });
    return fields;
}

function getTeamConfidence(field) {
    /*
    (6) [empty × 3, Array(0), Array(0), Array(0)]
        3:[PO: 1, Dev: 1]
        4:[Tester: 2, Dev: 2]
        5:[Team Lead: 1]
    */
   if (field === undefined) {
       return undefined;
   }
   var ctot = 0;
   var mbrcnt = 0;
    for (var i = 1; i <= 5; ++i) {
        var f = field[i.toString()];
        if (f !== undefined) {
            for (var r in f) {
                if (f.hasOwnProperty(r)) {
                    ctot += i * f[r];
                    mbrcnt += f[r];
                }
            }
        }
    }
    // console.log("Total confidence: " + ctot + ", Members: " + mbrcnt);
    return ctot/mbrcnt;
}

/**
 * Gets the first card label not containing an asterisk (*).
 * 
 * @param {Element} el The card element
 * @returns {String} The label name or _undefined_
 */
function getCardLabel(el) {
    var firstLabelTitle;
    $(el).find("span.card-label").each(function() {
        var title = $(this).attr("title");
        if (!firstLabelTitle && title.indexOf("*") === -1) {
            firstLabelTitle = title;
        }
    });
    return firstLabelTitle;
}

function getCardFields(el) {
    var fields = [];
    $(el).find("span.badge-text").each(function() {
        var title = $(this).text();
        var f = title.split(": ");
        // Make sure it's a custom field
        if (f.length !== 2) {
            return;
        }
        var fName = f[0];
        var fVal = f[1];
        fields[fName] = fVal;
    });
    return fields;
}

/**
 * Checks the name of a list.
 * 
 * @param {Element} el 
 * @param {String} listName 
 * @returns {Bool} _True_ if list title is _listName_ otherwise _false_
 */
function isListName(el, listName) {
    var list = $(el).has("h2:contains('" + listName + "')");
    return list.length > 0;
}

/**
 * Check if the team meets the constraints with regard to roles.
 * 
 * @param {Array} teamRoles Array with roles in team
 */
function isConstraintsMet(el, teamRoles) {
    var violationList = [];
    /*
     * Check if the # of any roles in team is less than the constraint
     */
    for (var role in teamRoles) {
        if (roleConstraints[role] && roleConstraints[role] > teamRoles[role]) {
            violationList.push("Not enough " + role + "s");
        }
    }

    /*
     * Check if any prescribed role is missing.
     */
    for (var role in roleConstraints) {
        if (!teamRoles[role]) {
            violationList.push("No " + role);
        }
    }

    var teamMembers = $(el).find("div.list-card-details:has(span.card-label)").not(":contains('concern')").length;
    if (teamMinSize !== undefined && teamMembers <= teamMinSize) {
        violationList.push("Not enough members");
    } else if (teamMaxSize !== undefined && teamMembers >= teamMaxSize) {
        violationList.push("Too many members");
    }

    return violationList;
}

/**
 * Get a count for all labels used in a list.
 * 
 * @param {Element} el 
 * @returns {Array} An associative array with labels and their respective count
 */
function getCardLabels(el, mainRolesOnly) {
    var cardLabels = [];
    $(el).find("span.card-label").each(function() {
        var title = $(this).attr("title");
        if (mainRolesOnly && (title === "concern" || title.indexOf("*") !== -1)) {
            return;
        }
        if (cardLabels[title] === undefined) {
            cardLabels[title] = 0;
        }
        cardLabels[title]++;
    });
    return cardLabels;
}

