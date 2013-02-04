"use strict";

/**
 * Copyright (c) 2011 Mikk Kiilaspää (mikk36 at mikk36 eu)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */

if(typeof(window.console) === 'undefined') window.console = {log: function (){}};

if (!Date.now)
{
  Date.now = function now()
  {
    return +new Date();
  };
}

var logAnalyzer = {
  chart: null,
  inputData: [],
  graphDataDealt: [],
  graphDataReceived: [],
  statsData: {
    received: [],
    dealt: []
  },
  filesExpected: 0,
  filesRead: 0,
  timesShotTarget: 0,
  timesMissedTarget: 0,
  totalDamageDealt: 0,
  timesShotReceived: 0,
  timesMissedReceived: 0,
  totalDamageReceived: 0,
  firstTimestamp: null,
  lastTimestamp: null,
  initPage: function() {
    if(!this.checkSupport()) {
      $("body").append('<div class="ui-widget" id="not-supported"><div class="ui-state-error ui-corner-all"><p><span class="ui-icon ui-icon-alert"></span><strong>Alert: </strong>Browser not supported.<br><br>Known supported browsers are <span class="no-break">Firefox 4+</span>, <span class="no-break">Chrome 6+</span> and <span class="no-break">Opera 11+</span>.</p></div></div>');
      return;
    }
    $("body").append('<div id="page" class="ui-widget ui-widget-content ui-corner-all"></div>');
    this.initFileInput();
    this.initContents();
    this.initCopyright();
  },
  checkSupport: function() {
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      return true;
    }
    return false;
  },
  initFileInput: function() {
    $("#page").append('<div id="input"></div>');
    $("#input").append('<input type="file" id="filesInput" multiple="">');
    $("#filesInput").bind('change', logAnalyzer.handleInput);
    $("#input").append('<div id="filesDrag">Drop files here</div>');
    $("#filesDrag").bind('dragover', logAnalyzer.handleDragOver);
    $("#filesDrag").bind('drop', logAnalyzer.handleInput);
    $("#input").append('<output id="fileList"></output>');
//    $("#input").append('<button id="hideContents">Show/hide debug</button><pre id="fileContents"></pre>');
//    $("#hideContents").click(function() {
//      $("#fileContents").toggle();
//    });
//    $("#fileContents").hide();
  },
  initContents: function() {
    $("#page").append('<div id="contents"></div>');
    $("#contents").append('<div id="damageGraph"></div><pre id="unidentified"></pre><p id="textGlobal"></p><p id="textTable"></p>');
  },
  handleInput: function(e) {
    var files;
    if(e.target.id == "filesDrag") {
      e.stopPropagation();
      e.preventDefault();
      files = e.originalEvent.dataTransfer.files;
    }
    else {
      files = e.target.files;
    }
    var output = [];
    $("#fileContents, #textGlobal, #textTable, #unidentified").html('');
    $("#damageGraph").html('').hide();
    logAnalyzer.inputData = [];
    logAnalyzer.logEntries = [];
    logAnalyzer.filesExpected = files.length;
    logAnalyzer.filesRead = 0;
    jQuery.each(files, function(index, file) {
      output.push('<li><strong>', file.name, '</strong> (', file.type || 'n/a', ') - ', file.size, ' bytes</li>');
      var reader = new FileReader();
      reader.onload = function(e) {
        logAnalyzer.filesRead++;
        var lines = e.target.result.match(/^.*([\n\r]+|$)/gm);
        logAnalyzer.parseLines(lines);
        if(logAnalyzer.filesRead == logAnalyzer.filesExpected)
          logAnalyzer.parseLog();
      };
      reader.readAsText(file);
    });
    $("#fileList").html('<ul>'+output.join('')+'</ul>');
  },
  handleDragOver: function(e) {
    e.stopPropagation();
    e.preventDefault();
  },
  initCopyright: function() {
    $("body").append('<div id="copyright" class="ui-widget"><span>CCP Copyright Notice</span><p>EVE Online, the EVE logo, EVE and all associated logos and designs are the intellectual property of CCP hf. All artwork, screenshots, characters, vehicles, storylines, world facts or other recognizable features of the intellectual property relating to these trademarks are likewise the intellectual property of CCP hf. EVE Online and the EVE logo are the registered trademarks of CCP hf. All rights are reserved worldwide. All other trademarks are the property of their respective owners. CCP hf. has granted permission to Mikk Kiilaspää to use EVE Online and all associated logos and designs for promotional and information purposes on its website but does not endorse, and is not in any way affiliated with, Mikk Kiilaspää. CCP is in no way responsible for the content on or functioning of this website, nor can it be liable for any damage arising from the use of this website.</p></div>');
    $("#copyright span").click(function() {
      $("#copyright p").fadeToggle('fast');
    });
  },
  parseLines: function(lines) {
    jQuery.each(lines, function(index, line) {
      if(line[0] != '[')
        return;
      if(line.substr(25, 6) != 'combat')
        return;
      line = line.trim();
      var data = {};

      var text = line.substr(33);

      // Start of the new parsing for the log file changes in Retribution.
      // I place no restrictions on its use.  -- Professor Latha'Serevi, Eve Uni.

      // these variables go into the output data
      var received;
      var missed;
      var hitType;
      var attacker_name='';  // enemy ship or my weapon
      var attacker_weapon;
      var attacked='';
      var damageAmount = 0;

      // remove all font formatting, find ' - ' separators
      var formatting_start = text.search(/</);
      while ( formatting_start != -1 ) {
        var formatting_end = text.search(/>/);
        // Are we somehow missing a formatting end tag?
        if (formatting_end == -1) {
          console.log("line 158: formatting_end == " + formatting_end);
          return; // surprise, bail
        }
        text = text.substr(0, formatting_start) + text.substr(formatting_end + 1);
        formatting_start = text.search(/</);
      }
      var first_separator = text.search(/ - /);
      var second_separator_offset = -1;
      if (first_separator != -1) {
        second_separator_offset = text.substr(first_separator + 3).search(/ - /);
      }
      
      // Are we being scrambled instead?
      // Warp scramble attempt from  (Vexor)Annaka Hansen  <IVY> to  (Thorax)Jim Womack  <SSC>
      if (text.search(/Warp scramble attempt/) != -1) {
        return; // discard
      }

      // Check if it's a miss
      // Sleepless Patroller misses you completely.
      var misses_pos = text.search(/ misses /);
      
      // Check if it's a received miss
      if (misses_pos != -1 && text.substr(misses_pos + 8, 3) == 'you') {
        received = true;
        missed = true;
        var attacker_name = text.substr(0, misses_pos);
        // Hammerhead II belonging to Rhavas misses you completely - Hammerhead II
        var belonging_to_pos = attacker_name.search(/ belonging to /);
        if (belonging_to_pos >= 0) {
          attacker_name = attacker_name.substr(belonging_to_pos + 14);
        }
        
      // Check if it's our miss
      } else if (misses_pos != -1) {
        // Your Valkyrie II misses Sleepless Watchman completely - Valkyrie II
        // Your group of XYZ misses Sleepless Escort completely - XYZ
        received = false;
        missed = true;
        // Are we missing first separator or do we somehow have two of them? Should only have 1
        if (first_separator == -1 || second_separator_offset != -1) {
          console.log("line 191: first_separator == " + first_separator + " || second_separator_offset != " + second_separator_offset);
          return;  // surprise, bail
        }
        attacker_name = text.substr(first_separator + 3); // my weapon always occurs twice, use 2nd one
        
        var completely_pos = text.search(/ completely /);
        // Our own miss line should always have a word "completely" and it should be the last word in the first part of text
        if (completely_pos == -1 || completely_pos < misses_pos) {
          console.log("line 197: completely_pos == " + completely_pos + " || completely_pos: " + completely_pos + " < misses_pos: " + misses_pos);
          return;  // surprise, bail
        }
        attacked = text.substr(misses_pos + 8, completely_pos - misses_pos - 8);
        
        // It's a hit!
      } else {
        missed = false;
        // Are we missing first separator?
        if (first_separator == -1) {
          console.log("line 204: first_separator == " + first_separator);
          return;  // surprise, bail
        }
        var from_pos = text.search(/ from /);
        var to_pos = text.search(/ to /);
        // We were hit!
        if (from_pos != -1 && (to_pos == -1 || to_pos > from_pos)) {
          received = true;
          damageAmount = text.substr(0, from_pos);
          attacker_name = text.substr(from_pos + 6, first_separator - from_pos - 6);
          if (second_separator_offset == -1) {
            // 64 from Sleepless Escort - Smashes
            attacker_weapon = 'unknown';
            hitType = text.substr(first_separator + 3);
          } else {
            // 515 from Sleepless Escort - Phantasmata Missile - Hits
            attacker_weapon = text.substr(first_separator + 3, second_separator_offset);
            hitType = text.substr(first_separator + 3 + second_separator_offset + 3);
          }
        // Someone else was hit!
        } else {
          // 20 to Sleepless Watchman - Valkyrie II - Glances Off
          received = false;
          // Are we missing both "from" and "to" or do we only have one separator for a "to" line?
          if (to_pos == -1 || (from_pos != -1 && from_pos < to_pos) || second_separator_offset == -1) {
            console.log("line 226: to_pos == " + to_pos + " || (from_pos != " + from_pos + " && from_pos: " + from_pos + " < to_pos: " + to_pos + ") || second_separator_offset == " + second_separator_offset);
            return;  // surprise, bail
          }
          damageAmount = text.substr(0, to_pos);
          attacked = text.substr(to_pos + 4, first_separator - to_pos - 4);
          attacker_name = text.substr(first_separator + 3, second_separator_offset);
          hitType = text.substr(first_separator + 3 + second_separator_offset + 3);
        }
      }
      // fix for PVP enemy names with corp and ship type as below, normalize to name alone
      // 21 to Kulper[FCFTW](Thorax) - Limited Electron Blaster I - Grazes
      var square_bracket_pos = attacked.indexOf('[');
      if (square_bracket_pos > 1) {
        attacked = attacked.substr(0, square_bracket_pos);
      }
      square_bracket_pos = attacker_name.indexOf('[');
      if (square_bracket_pos > 1) {
        attacker_name = attacker_name.substr(0, square_bracket_pos);
      }

      // end of Professor Latha'Serevi's new parsing for Retribution

      data.date = new Date(parseInt(line.substr(2, 4)), parseInt(line.substr(7, 2)), parseInt(line.substr(10, 2)), parseInt(line.substr(13, 2)), parseInt(line.substr(16, 2)), parseInt(line.substr(19, 2)));
      data.received = received;
      data.missed = missed;
      data.hitType = hitType;
      data.attacker_name = attacker_name;
      data.attacker_weapon = attacker_weapon;
      data.attacked = attacked;
      data.damageAmount = parseInt(damageAmount);
      logAnalyzer.inputData.push(data);
    });
  },
  parseLog: function() {
    logAnalyzer.inputData.sort(function(a, b) {
      return a.date - b.date; //sort by date ascending
    });
    //var outputDebug = '';
    logAnalyzer.timesShotTarget = 0;
    logAnalyzer.timesMissedTarget = 0;
    logAnalyzer.totalDamageDealt = 0;
    logAnalyzer.timesShotReceived = 0;
    logAnalyzer.timesMissedReceived = 0;
    logAnalyzer.totalDamageReceived = 0;
    logAnalyzer.graphDataDealt = [];
    logAnalyzer.graphDataReceived = [];
    logAnalyzer.statsData.dealt = [];
    logAnalyzer.statsData.received = [];
    if(logAnalyzer.inputData.length == 0)
      return;
    logAnalyzer.firstTimestamp = logAnalyzer.inputData[0].date.getTime() / 1000;
    logAnalyzer.lastTimestamp = logAnalyzer.inputData[logAnalyzer.inputData.length - 1].date.getTime() / 1000;
    jQuery.each(logAnalyzer.inputData, function(index, line) {
      if(line.received) {
        if(logAnalyzer.statsData.received[line.attacker_name] === undefined)
          logAnalyzer.statsData.received[line.attacker_name] = {name: line.attacker_name,damage: 0, shots: 0, missed: 0};
        logAnalyzer.statsData.received[line.attacker_name].shots++;
        logAnalyzer.statsData.received[line.attacker_name].damage += line.damageAmount;
        if(line.missed)
          logAnalyzer.statsData.received[line.attacker_name].missed++;

        if(logAnalyzer.graphDataReceived[line.date.getTime()/1000] === undefined)
          logAnalyzer.graphDataReceived[line.date.getTime()/1000] = line.damageAmount;
        else
          logAnalyzer.graphDataReceived[line.date.getTime()/1000] += line.damageAmount;

        logAnalyzer.timesShotReceived++;
        if(line.missed) {
          logAnalyzer.timesMissedReceived++;
        } else {
          logAnalyzer.totalDamageReceived += parseFloat(line.damageAmount);
        }
      } else {
        if(logAnalyzer.statsData.dealt[line.attacker_name] === undefined)
          logAnalyzer.statsData.dealt[line.attacker_name] = [];
        if(logAnalyzer.statsData.dealt[line.attacker_name][line.attacked] === undefined)
          logAnalyzer.statsData.dealt[line.attacker_name][line.attacked] = {name: line.attacked, damage: 0, shots: 0, missed: 0};
        logAnalyzer.statsData.dealt[line.attacker_name][line.attacked].shots++;
        logAnalyzer.statsData.dealt[line.attacker_name][line.attacked].damage += line.damageAmount;
        if(line.missed)
          logAnalyzer.statsData.dealt[line.attacker_name][line.attacked].missed++;

        if(logAnalyzer.graphDataDealt[line.date.getTime()/1000] === undefined)
          logAnalyzer.graphDataDealt[line.date.getTime()/1000] = line.damageAmount;
        else
          logAnalyzer.graphDataDealt[line.date.getTime()/1000] += line.damageAmount;

        logAnalyzer.timesShotTarget++;
        if(line.missed) {
          logAnalyzer.timesMissedTarget++;
        } else {
          logAnalyzer.totalDamageDealt += parseFloat(line.damageAmount);
        }
      }
    });

    this.initGraphs();
    this.initStats();

    $("#textGlobal").append("Hit target " + (logAnalyzer.timesShotTarget - logAnalyzer.timesMissedTarget) + " times<br>");
    $("#textGlobal").append("Missed target " + logAnalyzer.timesMissedTarget + " times<br>");
    var hitPercentage = 0;
    if(logAnalyzer.timesShotTarget > 0) {
      hitPercentage = 100 - Math.round(logAnalyzer.timesMissedTarget / logAnalyzer.timesShotTarget * 100);
    }
    $("#textGlobal").append("Hit percentage " + hitPercentage + "%<br>");
    $("#textGlobal").append("Total damage dealt: " + (Math.round(logAnalyzer.totalDamageDealt*10)/10) + "<br>");
    hitPercentage = 0;
    if(logAnalyzer.timesShotReceived > 0) {
      hitPercentage = 100 - Math.round(logAnalyzer.timesMissedReceived / logAnalyzer.timesShotReceived * 100);
    }
    $("#textGlobal").append("Hit you " + (logAnalyzer.timesShotReceived - logAnalyzer.timesMissedReceived) + " times<br>");
    $("#textGlobal").append("Missed you " + logAnalyzer.timesMissedReceived + " times<br>");
    $("#textGlobal").append("Hit percentage " + hitPercentage + "%<br>");
    $("#textGlobal").append("Total damage received: " + (Math.round(logAnalyzer.totalDamageReceived*10)/10) + "<br>");
    //$("#fileContents").appendText(outputDebug);
  },
  sortObject: function(arr) {
    // Setup Arrays
    var sortedKeys = new Array();
    var sortedObj = {};

    // Separate keys and sort them
    for (var i in arr){
      sortedKeys.push(i);
    }
    sortedKeys.sort();

    // Reconstruct sorted obj based on keys
    for (var i in sortedKeys){
      sortedObj[sortedKeys[i]] = arr[sortedKeys[i]];
    }
    return sortedObj;
  },
  initStats: function() {
    var textDealt = "", textReceived = "";
    var index, item, target, data;
    for(index in logAnalyzer.statsData.dealt) {
      item = logAnalyzer.statsData.dealt[index];
      item = logAnalyzer.sortObject(item);
      textDealt += "<tr class=\"dealt\"><th colspan=\"6\">" + index + "</th></tr>";
      for(target in item) {
        data = item[target];
        textDealt += "<tr class=\"dealt\"><td>" + target + "</td><td>" + Math.round(data.damage*10)/10 + "</td><td>" + Math.round((data.damage/data.shots)*10)/10 + "</td><td>" + (data.shots - data.missed) + "</td><td>" + data.missed + "</td><td>" + (100 - Math.round((data.missed/data.shots)*100)) + "%</td></tr>";
      }
    }
    logAnalyzer.statsData.received = logAnalyzer.sortObject(logAnalyzer.statsData.received);
    for(index in logAnalyzer.statsData.received) {
      data = logAnalyzer.statsData.received[index];
      textReceived += "<tr class=\"received\"><td>" + index + "</td><td>" + Math.round(data.damage*10)/10 + "</td><td>" + Math.round((data.damage/data.shots)*10)/10 + "</td><td>" + (data.shots - data.missed) + "</td><td>" + data.missed + "</td><td>" + (100 - Math.round((data.missed/data.shots)*100)) + "%</td></tr>";
    }
    $("#textTable").html("<table class=\"damageStats\"><tr class=\"dealt\"><th>Target</th><th>Total damage</th><th>Average damage</th><th>Hits</th><th>Misses</th><th>Hit %</th></tr>" + textDealt + "<tr class=\"received\"><th>Target</th><th>Total damage</th><th>Average damage</th><th>Hits</th><th>Misses</th><th>Hit %</th></tr>" + textReceived + "</table>");
  },
  initGraphs: function() {
    var dataReceived = [], dataDealt = [];
    var maxSteps = 500, minSteps = 10;

    var stepSize = Math.ceil((logAnalyzer.lastTimestamp - logAnalyzer.firstTimestamp) / maxSteps);
    if(stepSize < minSteps)
      stepSize = minSteps;

    var dateOffset = new Date();
    dateOffset = dateOffset.getTimezoneOffset() * 60;

    for(var i = logAnalyzer.firstTimestamp; i <= logAnalyzer.lastTimestamp; i += stepSize) {
      var totalReceived = 0, totalDealt = 0;
      for(var j = i - stepSize; j <= i + stepSize; j++) {
        if(logAnalyzer.graphDataReceived[j] !== undefined) {
          totalReceived += logAnalyzer.graphDataReceived[j];
        }
        if(logAnalyzer.graphDataDealt[j] !== undefined) {
          totalDealt += logAnalyzer.graphDataDealt[j];
        }
      }
      dataReceived.push([(i - dateOffset)*1000, totalReceived/(stepSize * 2 + 1)]);
      dataDealt.push([(i - dateOffset)*1000, totalDealt/(stepSize * 2 + 1)]);
    }

    $("#damageGraph").show();
    logAnalyzer.chart = new Highcharts.Chart({
      chart: {
        renderTo: 'damageGraph',
        type:     'spline',
        zoomType: 'x',
        backgroundColor: 'none'
      },
      title: {
        text: 'DPS Graph'
      },
      xAxis: {
        type: 'datetime'
      },
      yAxis: {
        title: {
          text: 'Damage (DPS)'
        },
        min: 0
      },
      tooltip: {
        formatter: function() {
          return '<strong>' + this.series.name + '</strong><br>' + Highcharts.dateFormat('%H:%M:%S', this.x) + "<br>" + Math.round(this.y*10)/10 + ' DPS';
        }
      },
      series: [{
        name: 'Damage dealt',
        data: dataDealt
      }, {
        name: 'Damage received',
        data: dataReceived
      }]
    });
  }
};

$(document).ready(
  function()
  {
    logAnalyzer.initPage();
  }
);

function pad(n)
{
  return n<10 ? '0'+n : n
}

/*
**  jquery.text.js -- Utilitaires sur l'utilisation de TextNode
**  Copyright (c) 2007 France T�l�com
**  Julien Wajsberg <julien.wajsberg@orange-ftgroupe.com>
**
**  Projet Siclome
**
**  $LastChangedDate$
**  $LastChangedRevision$
*/

(function($) {
  /* jQuery object extension methods */
  $.fn.extend({
  appendText: function(e) {
    if ( typeof e == "string" )
      return this.append( document.createTextNode( e ) );
    return this;
  }
  });
})(jQuery);