'use strict'

const fs = require('fs-extra')
const path = require('path')

const moment = require('moment')
const mustache = require('mustache')

const splightUrls = require('../../urls')
const timespan = require('../../timespan')
const templates = require('./templates')

function makeGenerator (data, reload = false) {
  for (const citySlug in data.cities) {
    const city = data.cities[citySlug]
    city.slug = citySlug
    city.url = splightUrls.makeCity({city: citySlug})

    for (const tagSlug in city.tags) {
      const tag = city.tags[tagSlug]
      tag.slug = tagSlug
    }

    const events = []
    for (const mainTag in city.events) {
      city.events[mainTag].forEach(function ({title, occurences, datetime}) {
        if (!occurences) occurences = [{datetime}]
        occurences.forEach(function ({datetime}) {
          events.push({
            title,
            start: moment(datetime, 'YYYY/MM/DD HH:mm', true),
            tags: [mainTag]
          })
        })
      })
    }
    city.events = events.sort(
      (e1, e2) => e1.start.diff(e2.start)
    )
  }

  function makeHtml (contentTemplate, contentData, subtitle, lead) {
    return mustache.render(
      templates.container,
      {
        static_content: mustache.render(contentTemplate, contentData),
        subtitle: subtitle,
        lead: lead,
        reload: reload
      }
    )
  }

  function indexPage () {
    return makeHtml(
      templates.staticContent.index,
      {
        cities: Object.values(data.cities).map(({name, url}) => ({name, url}))
      },
      null,
      'Votre agenda culturel régional'
    )
  }

  function cityPage (citySlug) {
    const city = data.cities[citySlug]

    const tags = Object.values(city.tags).sort(
      (tag1, tag2) => tag1.display_order - tag2.display_order
    ).map(
      ({slug, title}) => ({slug, title})
    )

    return makeHtml(
      templates.staticContent.city.index,
      {
        city: city,
        tags: tags,
        first_week_url: splightUrls.makeWeek({city: city.slug, week: city.events[0].start})
      },
      {href: splightUrls.makeCity({city: city.slug}), text: city.name},
      'Votre agenda culturel à ' + city.name + ' et dans sa région'
    )
  }

  function timespanPage (citySlug, timespanSlug) {
    const city = data.cities[citySlug]

    const {
      duration,
      startDate,
      dateAfter,
      previousLinkSlug,
      nextLinkSlug,
      previousLinkText,
      nextLinkText,
      now1LinkText,
      now2LinkText
    } = timespan.make(timespanSlug)

    const eventsByDay = {}
    for (var d = startDate.clone(); d.isBefore(dateAfter); d.add(1, 'day')) {
      eventsByDay[d.format('YYYY-MM-DD')] = []
    }
    city.events.forEach(function ({title, start}) {
      const dayEvents = eventsByDay[start.format('YYYY-MM-DD')]
      if (dayEvents !== undefined) {
        dayEvents.push({
          title,
          time: start.format('HH:mm')
        })
      }
    })
    const days = []
    for (d = startDate.clone(); d.isBefore(dateAfter); d.add(1, 'day')) {
      const date = d.format('YYYY-MM-DD')
      days.push({
        date,
        events: eventsByDay[date]
      })
    }

    const tags = Object.values(city.tags).sort((t1, t2) => t1.display_order - t2.display_order).map(({slug, title}) => ({slug, title}))

    return makeHtml(
      templates.staticContent.city.timespan,
      {
        city,
        duration,
        startDate: startDate.format() /* + ' au ' + dateAfter.format() */,
        days,
        tags,
        previousLinkSlug: previousLinkSlug,
        nextLinkSlug: nextLinkSlug,
        previousLinkText: previousLinkText,
        nextLinkText: nextLinkText,
        now1LinkText: now1LinkText,
        now2LinkText: now2LinkText
      },
      {href: splightUrls.makeCity({city: city.slug}), text: city.name},
      'Votre agenda culturel à ' + city.name + ' et dans sa région'
    )
  }

  return {
    indexPage: indexPage,
    cityPage: cityPage,
    timespanPage: timespanPage
  }
}

exports.generator = makeGenerator

exports.generate = function (data, outputDirectory) {
  const generator = makeGenerator(data)

  function outputIndex (html, destination) {
    fs.outputFileSync(path.join(outputDirectory, destination, 'index.html'), html)
  }

  outputIndex(generator.indexPage(), '')

  for (const citySlug in data.cities) {
    outputIndex(generator.cityPage(citySlug), citySlug)
  }
}
