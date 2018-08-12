'use strict'

const jQuery = require('jquery')
const mustache = require('mustache')
const URI = require('urijs')

const datetime = require('../../datetime')
const durations = require('../durations')
const pages = require('../pages')
const paths = require('../paths')
const template = require('./linksToolbar.html')

function make ({citySlug, startDate, duration}) {
  function makeLinks (now) {
    function make (desc, d) {
      return {text: desc.text, path: paths.timespan(citySlug, desc.startDate(d), duration)}
    }

    return {
      previous: make(duration.links.previous, startDate),
      next: make(duration.links.next, startDate),
      now1: make(duration.links.now1, now),
      now2: make(duration.links.now2, now)
    }
  }

  function render (data) {
    // @todo Handle the two different 'now's in this project: generation date and visit date.
    // Currently, if the static version of the public website is visited a week after it's been generated,
    // we have dead links to the week after the last one generated.
    const links = makeLinks(datetime.generationNow())
    // @todo Hide link to previous before now
    links.previous.path = pages.timespan(citySlug, duration.links.previous.startDate(startDate), duration).exists(data) && links.previous.path
    links.next.path = pages.timespan(citySlug, duration.links.next.startDate(startDate), duration).exists(data) && links.next.path

    return mustache.render(
      template,
      {
        links,
        durations:
          Array.from(durations.all)
            .sort((d1, d2) => d2.days - d1.days)
            .map(d => {
              const href = paths.timespan(citySlug, startDate, d)
              const display = d.name
              const active = d === duration
              return {href, display, active}
            })
      }
    )
  }

  function initialize () {
    const links = makeLinks(datetime.visitNow())

    jQuery('.sp-timespan-now-1').attr('href', (index, href) => URI(href).path(links.now1.path).toString())
    jQuery('.sp-timespan-now-2').attr('href', (index, href) => URI(href).path(links.now2.path).toString())
  }

  return {render, initialize}
}

Object.assign(exports, {make})
