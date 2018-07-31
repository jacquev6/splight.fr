'use strict'

const assert = require('assert').strict
const moment = require('moment')
const URI = require('urijs')

const cityContent = require('./widgets/cityContent')
const cityTitle = require('./widgets/cityTitle')
const durations = require('./durations')
const paths = require('./paths')
const rootContent = require('./widgets/rootContent')
const rootTitle = require('./widgets/rootTitle')
const timespanContent = require('./widgets/timespanContent')

function root () {
  const title = rootTitle.make()
  const content = rootContent.make()

  return {
    path: paths.root(),
    dataRequest: {
      requestString: '{cities{slug name}}',
      variableValues: undefined
    },
    exists: data => true,
    title,
    content
  }
}

function city (citySlug) {
  const title = cityTitle.make({citySlug})
  const content = cityContent.make({citySlug})

  return {
    path: paths.city(citySlug),
    dataRequest: {
      requestString: 'query($citySlug:ID!){city(slug:$citySlug){slug name tags{slug title}}}',
      variableValues: {citySlug}
    },
    exists: data => !!data.city,
    title,
    content
  }
}

function timespan (citySlug, startDate, duration) {
  startDate = duration.clip(startDate)
  const dateAfter = duration.dateAfter(startDate)

  const title = cityTitle.make({citySlug})
  const content = timespanContent.make({citySlug, startDate, duration})

  return {
    path: paths.timespan(citySlug, startDate, duration),
    dataRequest: {
      requestString: 'query($citySlug:ID!,$first:Date!,$after:Date!){city(slug:$citySlug){slug name tags{slug title} firstDate days(first:$first,after:$after){date events{time title mainTag{slug} tags{slug} artist{name} location{name}}}}}',
      variableValues: {
        citySlug,
        first: startDate.format(moment.HTML5_FMT.DATE),
        after: dateAfter.format(moment.HTML5_FMT.DATE)
      }
    },
    exists: data => (
      data.city &&
      startDate.isSameOrAfter(durations.oneWeek.clip(moment(data.city.firstDate, moment.HTML5_FMT.DATE, true))) &&
      dateAfter.isSameOrBefore(durations.oneWeek.clip(moment()).add(5, 'weeks'))
    ),
    title,
    content
  }
}

timespan.ofSlugs = function (citySlug, timespanSlug) {
  for (var duration of durations.all) {
    const startDate = moment(timespanSlug, duration.slugFormat, true)
    if (startDate.isValid()) {
      return timespan(citySlug, startDate, duration)
    }
  }
}

function fromPath (url) {
  const parts = URI.parse(url).path.split('/')
  assert(parts[0] === '', 'Unexpected path: ' + url)
  assert(parts.slice(-1)[0] === '', 'Unexpected path: ' + url)
  switch (parts.length) {
    case 2:
      return root()
    case 3:
      return city(parts[1])
    case 4:
      return timespan.ofSlugs(parts[1], parts[2])
    default:
      assert.fail('Unexpected path: ' + url)
  }
}

Object.assign(exports, {root, city, timespan, fromPath})
