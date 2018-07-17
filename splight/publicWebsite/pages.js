'use strict'

/* global Modernizr, history */

const assert = require('assert')
const jQuery = require('jquery')
const moment = require('moment')
const moment_fr = require('moment/locale/fr') // eslint-disable-line
const mustache = require('mustache')
const URI = require('urijs')

// @todo Remove when https://github.com/moment/moment/issues/4698 is fixed on npm
moment.HTML5_FMT.WEEK = 'GGGG-[W]WW'
assert.equal(moment.HTML5_FMT.WEEK, 'GGGG-[W]WW')

const randomizeCanvas = require('../../randomizeCanvas')

moment.locale('fr')

function randomizeCanvases () {
  if (Modernizr.canvas) {
    jQuery('canvas[data-sp-random-seed]').each(function () {
      const c = jQuery(this)
      randomizeCanvas({
        canvas: this,
        seed: c.data('sp-random-seed'),
        width: c.attr('width'),
        height: c.attr('height')
      })
    })
  }
}

const timespan = (function () {
  const oneWeek = (function () {
    const slugFormat = moment.HTML5_FMT.WEEK

    function slugify (startDate) {
      return startDate.format(slugFormat)
    }

    function make (startDate) {
      return {
        duration: 'Semaine',
        durationValue: 7,
        startDate: startDate.clone(),
        dateAfter: startDate.clone().add(7, 'days'),
        previousLinkText: 'Semaine précédente',
        previousLinkSlug: slugify(startDate.clone().subtract(7, 'days')),
        nextLinkText: 'Semaine suivante',
        nextLinkSlug: slugify(startDate.clone().add(7, 'days')),
        now1LinkText: 'Cette semaine',
        now1LinkSlug: now => slugify(now),
        now2LinkText: 'La semaine prochaine',
        now2LinkSlug: now => slugify(now.clone().add(7, 'days'))
      }
    }

    return {slugFormat, slugify, make}
  }())

  const threeDays = (function () {
    const slugFormat = moment.HTML5_FMT.DATE + '+2'

    function slugify (startDate) {
      return startDate.format(slugFormat)
    }

    function make (startDate) {
      return {
        duration: '3 jours à partir',
        durationValue: 3,
        startDate: startDate.clone(),
        dateAfter: startDate.clone().add(3, 'days'),
        previousLinkText: 'Jours précédents',
        previousLinkSlug: slugify(startDate.clone().subtract(1, 'days')),
        nextLinkText: 'Jours suivants',
        nextLinkSlug: slugify(startDate.clone().add(1, 'days')),
        now1LinkText: 'Ces 3 jours',
        now1LinkSlug: now => slugify(now),
        now2LinkText: 'Le week-end prochain',
        now2LinkSlug: now => slugify(now.clone().add(3, 'days').startOf('isoWeek').add(4, 'days'))
      }
    }

    return {slugFormat, slugify, make}
  }())

  const oneDay = (function () {
    const slugFormat = moment.HTML5_FMT.DATE

    function slugify (startDate) {
      return startDate.format(slugFormat)
    }

    function make (startDate) {
      return {
        duration: 'Journée',
        durationValue: 1,
        startDate: startDate.clone(),
        dateAfter: startDate.clone().add(1, 'days'),
        previousLinkText: 'Journée précédente',
        previousLinkSlug: slugify(startDate.clone().subtract(1, 'days')),
        nextLinkText: 'Journée suivante',
        nextLinkSlug: slugify(startDate.clone().add(1, 'days')),
        now1LinkText: "Aujourd'hui",
        now1LinkSlug: now => slugify(now),
        now2LinkText: 'Demain',
        now2LinkSlug: now => slugify(now.clone().add(1, 'days'))
      }
    }

    return {slugFormat, slugify, make}
  }())

  function make (timespanSlug) {
    return [oneWeek, threeDays, oneDay].reduce(function (r, ts) {
      if (r) {
        return r
      } else {
        const startDate = moment(timespanSlug, ts.slugFormat, true)
        if (startDate.isValid()) {
          return ts.make(startDate)
        } else {
          return null
        }
      }
    }, null)
  }

  return {
    make,
    oneWeek,
    threeDays,
    oneDay
  }
}())

module.exports = function (fetcher) {
  const source = (function () {
    const cities = fetcher.getCities().then(cities => {
      cities.forEach(city => {
        city.url = cityIndex(city.slug).path
        city.firstDate = moment(city.firstDate, moment.HTML5_FMT.DATE, true)
      })
      return cities
    })

    function getCities () {
      return cities
    }

    const citiesBySlug = cities.then(cities => {
      const citiesBySlug = {}
      cities.forEach(city => {
        citiesBySlug[city.slug] = city
      })
      return citiesBySlug
    })

    async function getCity (citySlug) {
      return (await citiesBySlug)[citySlug]
    }

    const cityWeeks = {}

    function getCityWeek (citySlug, week) {
      const key = citySlug + '/' + week.format(moment.HTML5_FMT.WEEK)
      if (!cityWeeks[key]) {
        cityWeeks[key] = fetcher.getCityWeek(citySlug, week).then(cityWeek => {
          cityWeek.events.forEach(event => {
            event.start = moment(event.start, moment.HTML5_FMT.DATETIME_LOCAL, true)
          })
          return cityWeek
        })
      }
      return cityWeeks[key]
    }

    async function getEvents (citySlug, startDate, dateAfter) {
      const weeksToFetch = []
      for (var week = startDate.clone().startOf('isoWeek'); week.isBefore(dateAfter); week.add(7, 'days')) {
        weeksToFetch.push(getCityWeek(citySlug, week).then(({events}) => events))
      }
      const weeks = await Promise.all(weeksToFetch)
      return weeks.reduce((a, b) => a.concat(b)).filter(({start}) => start.isBetween(startDate, dateAfter, null, '[)'))
    }

    return {getCities, getCity, getEvents}
  }())

  function handleInternalLinkClick (event) {
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return true
    } else {
      navigateTo(jQuery(this).attr('href'))
      return false
    }
  }

  function navigateTo (url) {
    jQuery('.sp-modern').addClass('sp-loading')
    url = URI.parse(url)
    const page = fromUrl(url.path)

    page.make().then(async ({title, jumbotron, content}) => {
      jQuery('title').text(title)
      jQuery('#sp-jumbotron').html(jumbotron)
      jQuery('#sp-content').html(content)

      jQuery("#sp-jumbotron a[href^='/'], #sp-content a[href^='/']").on('click', handleInternalLinkClick)
      history.replaceState(null, window.document.title, URI(window.location.href).path(url.path).query(url.query || '').toString())
      await page.initializeInBrowser(false)
      jQuery('.sp-modern').removeClass('sp-loading')
    })
  }

  function hookInternalLinks (firstTime) {
    if (firstTime) {
      jQuery("a[href^='/']").on('click', handleInternalLinkClick)
    }
  }

  const index = {
    path: '/',
    initializeInBrowser: function (firstTime) {
      randomizeCanvases()
      hookInternalLinks(firstTime)
    },
    make: async function () {
      const cities = await source.getCities()
      return {
        title: 'Splight',
        jumbotron: '<h1 class="display-4"><a href="/">Splight</a></h1><p class="lead">Votre agenda culturel régional</p>',
        content: mustache.render(require('./pages/index.html'), {cities})
      }
    }
  }

  function makeCityTitle (city) {
    return mustache.render('{{name}} - Splight', city)
  }

  function makeCityJumbotron (city) {
    city.url = cityIndex(city.slug).path
    return mustache.render(
      '<h1 class="display-4"><a href="/">Splight</a> - <a href="{{url}}">{{name}}</a></h1>' +
      '<p class="lead">Votre agenda culturel à {{name}} et dans sa région</p>',
      city
    )
  }

  function cityIndex (citySlug) {
    return {
      path: ['', citySlug, ''].join('/'),
      initializeInBrowser: function (firstTime) {
        randomizeCanvases()
        hookInternalLinks(firstTime)
        jQuery('.sp-now-week-link').attr('href', (index, href) => URI(href).path(['', citySlug, timespan.oneWeek.slugify(moment()), ''].join('/')).toString())
      },
      make: async function () {
        const city = await source.getCity(citySlug)

        return {
          title: makeCityTitle(city),
          jumbotron: makeCityJumbotron(city),
          content: mustache.render(
            require('./pages/cityIndex.html'),
            {
              city,
              tags: city.tags,
              firstWeekUrl: ['', citySlug, timespan.oneWeek.slugify(city.firstDate)].join('/')
            }
          )
        }
      }
    }
  }

  function cityTimespan (citySlug, timespanSlug) {
    const ts = timespan.make(timespanSlug)

    return {
      path: ['', citySlug, timespanSlug, ''].join('/'),
      initializeInBrowser: function (firstTime) {
        randomizeCanvases()
        hookInternalLinks(firstTime)

        jQuery('.sp-timespan-now-1').attr('href', (index, href) => URI(href).path(['', citySlug, ts.now1LinkSlug(moment()), ''].join('/')).toString())
        jQuery('.sp-timespan-now-2').attr('href', (index, href) => URI(href).path(['', citySlug, ts.now2LinkSlug(moment()), ''].join('/')).toString())

        jQuery('.sp-timespan-previous').hide()
        source.getEvents(citySlug, ts.startDate.clone().subtract(1, 'day'), ts.startDate).then(() => jQuery('.sp-timespan-previous').show())
        jQuery('.sp-timespan-next').hide()
        source.getEvents(citySlug, ts.dateAfter, ts.dateAfter.clone().add(1, 'day')).then(() => jQuery('.sp-timespan-next').show())

        ;(function () {
          const dropdown = jQuery('#sp-timespan-duration')
          dropdown.val(ts.durationValue)
          dropdown.on('change', function () {
            const newTimespan = {1: timespan.oneDay, 3: timespan.threeDays, 7: timespan.oneWeek}[dropdown.val()]
            navigateTo(['', citySlug, newTimespan.slugify(ts.startDate), ''].join('/'))
          })
        }())

        const allTags = new Set(jQuery('#sp-tag-filtering input').map((index, input) => jQuery(input).val()).toArray())
        const query = URI.parseQuery(URI.parse(window.location.href).query)
        if (Object.keys(query).length === 0) {
          jQuery('#sp-tag-filtering input').prop('checked', true)
        } else {
          const displayedTags = new Set(Object.keys(query))
          jQuery('#sp-tag-filtering input').each(function (index, input) {
            input = jQuery(input)
            input.prop('checked', displayedTags.has(input.val()))
          })
        }

        function filterEvents () {
          jQuery('.sp-event').hide()
          const displayedTags = new Set()
          jQuery('#sp-tag-filtering input').each(function (index, input) {
            input = jQuery(input)
            const tag = input.val()
            if (input.prop('checked')) {
              displayedTags.add(tag)
              jQuery('.sp-tag-' + citySlug + '-' + tag).show()
            }
          })

          const newQuery = displayedTags.size === allTags.size ? '' : Array.from(displayedTags).sort().join('&')
          jQuery('.sp-tag-filtering-tagged-link').attr('href', function (index, href) {
            return URI(href).query(newQuery).toString()
          })
          history.replaceState(null, window.document.title, URI(window.location.href).query(newQuery).toString())
        }

        filterEvents()
        jQuery('#sp-tag-filtering input').on('change', filterEvents)
      },
      make: async function () {
        const city = await source.getCity(citySlug)

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
        } = ts

        const events = await source.getEvents(city.slug, startDate, dateAfter)

        const eventsByDay = {}

        for (var d = startDate.clone(); d.isBefore(dateAfter); d.add(1, 'day')) {
          eventsByDay[d.format(moment.HTML5_FMT.DATE)] = []
        }

        events.forEach(function ({title, start, tags}) {
          eventsByDay[start.format(moment.HTML5_FMT.DATE)].push({
            title,
            time: start.format('LT'),
            mainTag: tags[0],
            tags
          })
        })

        const days = []

        for (d = startDate.clone(); d.isBefore(dateAfter); d.add(1, 'day')) {
          days.push({
            date: d.format('ddd Do MMM'),
            events: eventsByDay[d.format(moment.HTML5_FMT.DATE)]
          })
        }

        return {
          title: makeCityTitle(city),
          jumbotron: makeCityJumbotron(city),
          content: mustache.render(
            require('./pages/cityTimespan.html'),
            {
              city,
              duration,
              startDate: startDate.format('dddd LL'),
              days,
              previousLinkSlug,
              nextLinkSlug,
              previousLinkText,
              nextLinkText,
              now1LinkText,
              now2LinkText
            }
          )
        }
      }
    }
  }

  function fromUrl (url) {
    const parts = URI.parse(url).path.split('/')
    assert(parts[0] === '', 'Unexpected path: ' + url)
    assert(parts.slice(-1)[0] === '', 'Unexpected path: ' + url)
    switch (parts.length) {
      case 2:
        return index
      case 3:
        return cityIndex(parts[1])
      case 4:
        return cityTimespan(parts[1], parts[2])
      default:
        assert.fail('Unexpected path: ' + url)
    }
  }

  const pages = {}

  pages.index = index
  pages.cityIndex = cityIndex
  pages.cityTimespan = cityTimespan
  pages.fromUrl = fromUrl

  return pages
}
