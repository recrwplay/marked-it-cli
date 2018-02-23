var common = require("./cli-common");
var builder = require('xmlbuilder');
const eLogger = require('electron-log');
const fse = require('fs-extra');
const util = require('util');
var jsYaml = require("js-yaml");
var path = require("path");

function parseYML(options) {

  let ymlFile = options.ymlPath;

  try {
    var stat = fse.statSync(ymlFile);
    if (stat.isFile()) {
      var readFd = fse.openSync(ymlFile, "r");
      ymlString = fse.readFileSync(readFd);
      tocObj = jsYaml.safeLoad(ymlString);
      fse.closeSync(readFd);
      return tocObj;
    }
  } catch(e) {
    /* this file is not present, which is fine, just continue */
    eLogger.debug("YML TOC ordering file not found: " + ymlFile);
  }

}

var generateTOC = function(generateOptions) {

  let adapter = generateOptions.adapter;
  let tocFilename = generateOptions.tocFilename;
  let destination = generateOptions.destination;
  let xmlMode = generateOptions.xmlMode;
  let FILENAME_TEMP = generateOptions.FILENAME_TEMP;
  let EXTENSION_MARKDOWN_REGEX = generateOptions.EXTENSION_MARKDOWN_REGEX;

  let tocXMLObj = {
            property: [],
            topic: []
          };
  let topicOutput = [];

  let tocLabel = '';

  Object.keys(tocObj.properties).forEach(function(tocProperty) {
    if (tocProperty === 'name') {
      tocLabel = tocObj.properties[tocProperty];
    }
    tocXMLObj.property.push({
      "@name": tocProperty,
      "@value": tocObj.properties[tocProperty]
    }) 
  })

  var processTocTopic = function(options) {
    try {
      var readFd = fse.openSync(options.tocInfoFile, "r");
      var result = common.readFile(readFd);
      fse.closeSync(readFd);
      /* adjust contained relative links */
      var root = common.htmlToDom(result, {xmlMode: xmlMode})[0];

      var elementsWithHref = common.domUtils.find(function(node) {return node.attribs && node.attribs.href;}, [root], true, Infinity);
      elementsWithHref.forEach(function(current) {
        current.attribs.href = path.join(options.dirname, current.attribs.href).replace(/[\\]/g, "/");
      });
      var children = common.domUtils.getChildren(root);
      if (children.length) {
        newTopics = children[0];
      }
    } catch (err) {
      logger.err(err)
    }

    let loopOutput = [];

    let loop = newTopics.children;

    Object.keys(loop).forEach(function(i) {

      if (loop[i].type === 'tag') {
        
        loopOutput.push({
          "@href": loop[i].attribs.href,
          "@label": loop[i].attribs.label,
          property: {
            "@name": 'navgroup',
            "@value": options.navgroup
          }
        });
    
      }

    })

    let topicOutput = {
      'href': newTopics.attribs.href,
      'label': newTopics.attribs.label,
      'loopOutput': loopOutput
    }

    return topicOutput;

  }

  Object.keys(tocObj.navgroups).forEach(function(navgroup) {					
  
    Object.keys(tocObj.navgroups[navgroup]).forEach(function(tocItem) {

      let topicOutput = [];

      if (tocObj.navgroups[navgroup][tocItem].external) {
        
        // process external links
        topicOutput.push({
          "@href": tocObj.navgroups[navgroup][tocItem].external.url,
          "@label": tocObj.navgroups[navgroup][tocItem].external.title,
          property: {
            "@name": 'navgroup',
            "@value": navgroup
          } 
        });

      } else if (tocObj.navgroups[navgroup][tocItem].topicgroup) {

          // process a topicgroup

          let topicGroupOutput = [];

          let topicList = tocObj.navgroups[navgroup][tocItem].topicgroup.topics

          Object.keys(topicList).forEach(function(topic) {

            var dirname = path.dirname(topicList[topic]);
            var entryDestPath = path.join(destination, dirname);
            var entryTOCinfoPath = path.join(entryDestPath, FILENAME_TEMP);
            var basename = path.basename(topicList[topic]);
            var tocInfoFile = path.join(entryTOCinfoPath, basename.replace(EXTENSION_MARKDOWN_REGEX, "." + tocFilename));

            let options = {
              dirname: dirname,
              tocInfoFile: tocInfoFile,
              navgroup: navgroup
            }

            let result = processTocTopic(options);
      
            topicGroupOutput.push({
              "@href": result.href,
              "@label": result.label,
              property: {
                "@name": 'navgroup',
                "@value": navgroup
              },
              "topic" : result.loopOutput
            });

        })

        topicOutput.push({
          "@label": tocObj.navgroups[navgroup][tocItem].topicgroup.title,
          property: [
            {
              "@name": 'navgroup',
              "@value": navgroup
            },
            {
              "@name": 'topicgroup',
              "@value": tocObj.navgroups[navgroup][tocItem].topicgroup.title
            }
          ],
          "topic" : topicGroupOutput
      });

      } else {

        var dirname = path.dirname(tocObj.navgroups[navgroup][tocItem]);
        var entryDestPath = path.join(destination, dirname);
        var entryTOCinfoPath = path.join(entryDestPath, FILENAME_TEMP);
        var basename = path.basename(tocObj.navgroups[navgroup][tocItem]);
        var tocInfoFile = path.join(entryTOCinfoPath, basename.replace(EXTENSION_MARKDOWN_REGEX, "." + tocFilename));

        let options = {
          dirname: dirname,
          tocInfoFile: tocInfoFile,
          navgroup: navgroup
        }

        let result = processTocTopic(options);

        topicOutput.push({
          "@href": result.href,
          "@label": result.label,
          property: {
            "@name": 'navgroup',
            "@value": navgroup
          },
          "topic" : result.loopOutput
        });

      }

      if (topicOutput.length !== 0) {
        tocXMLObj.topic.push(topicOutput)
      }
      

    })

  })

  try {
    
    let xml = builder.create( 'toc', { encoding: 'utf-8' } )
    .att('label', tocLabel)
    .ele(tocXMLObj)

    return xml.end();

  } catch (err) {
    throw new Error(err)
  }

}

exports.parseYML = parseYML;
exports.generateTOC = generateTOC;