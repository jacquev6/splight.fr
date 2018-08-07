'use strict'

const jQuery = require('jquery')
const moment = require('moment')
const mustache = require('mustache')

const eventDetails_ = require('../publicWebsite/widgets/eventDetails')
const eventsTemplate = require('./widgets/events.html')
const template = require('./page.html')
const utils = require('./utils')
const whatForDisplay = require('../publicWebsite/widgets/eventDetails/what')
const whenForDisplay = require('../publicWebsite/widgets/eventDetails/when')
const whereForDisplay = require('../publicWebsite/widgets/eventDetails/where')

const {fillSelect, request} = utils

const eventDetailsForDisplay = eventDetails_.make({when: whenForDisplay, what: whatForDisplay, where: whereForDisplay})

function render ({scripts}) {
  return mustache.render(template, {scripts})
}

async function initialize () {
  const doc = jQuery(document)
  const isDebug = window.location.href.indexOf('?debug') !== -1

  const eventEditor = (function () {
    var active
    const modal = jQuery('#spa-modify-event-modal')

    modal.modal({backdrop: 'static', show: false})
    modal.on('hide.bs.modal', deactivate)
    jQuery('#spa-modify-event-save').on('click', save)

    doc.on('click', '#spa-edit-event-edit-preview-when', function () {
      active.editingWhen = !active.editingWhen
      active.editingWhat = false
      active.editingWhere = false
      refreshContent()
    })
    doc.on('click', '.spa-delete-occurrence', function () {
      const index = jQuery('.spa-delete-occurrence').index(this)
      active.event.occurrences.splice(index, 1)
      refreshContent()
    })
    doc.on('input', '#spa-new-occurrence', function () {
      const m = moment(jQuery('#spa-new-occurrence').val(), moment.HTML5_FMT.DATETIME_LOCAL, true)
      jQuery('#spa-add-occurrence').attr('disabled', !m.isValid())
    })
    doc.on('click', '#spa-add-occurrence', function () {
      const start = jQuery('#spa-new-occurrence').val()
      active.event.occurrences.push({start})
      refreshContent()
    })

    doc.on('click', '#spa-edit-event-edit-preview-what', function () {
      active.editingWhen = false
      active.editingWhat = !active.editingWhat
      active.editingWhere = false
      refreshContent()
    })
    doc.on('change', '#spa-edit-event-main-tag', function () {
      const previousMainTag = active.event.tags[0].slug
      const previousSecondaryTags = new Set(active.event.tags.slice(1).map(({slug}) => slug))

      const newMainTag = jQuery('#spa-edit-event-main-tag').val()
      const newSecondaryTags = new Set(previousSecondaryTags)

      if (previousSecondaryTags.has(newMainTag)) {
        newSecondaryTags.delete(newMainTag)
        newSecondaryTags.add(previousMainTag)
      }

      const tags = [newMainTag].concat(Array.from(newSecondaryTags))
      active.event.tags = tags.map(slug => active.tagsBySlug[slug])
      refreshContent()
    })
    doc.on('change', '.spa-edit-event-secondary-tag', function () {
      const mainTag = jQuery('#spa-edit-event-main-tag').val()
      const secondaryTags = jQuery('.spa-edit-event-secondary-tag:checked').map((index, checkbox) => jQuery(checkbox).val()).toArray()
      const tags = [mainTag].concat(secondaryTags)
      active.event.tags = tags.map(slug => active.tagsBySlug[slug])
      refreshContent()
    })
    doc.on('input', '#spa-edit-event-title', function () {
      active.event.title = jQuery('#spa-edit-event-title').val()
      refreshHeaderAndFooter()
    })
    doc.on('change', '#spa-edit-event-artist', function () {
      active.event.artist = active.artistsBySlug[jQuery('#spa-edit-event-artist').val()]
      refreshHeaderAndFooter()
    })

    doc.on('click', '#spa-edit-event-edit-preview-where', function () {
      active.editingWhen = false
      active.editingWhat = false
      active.editingWhere = !active.editingWhere
      refreshContent()
    })
    doc.on('change', '#spa-edit-event-location', function () {
      active.event.location = active.locationsBySlug[jQuery('#spa-edit-event-location').val()]
      refreshHeaderAndFooter()
    })
    doc.on('click', '#spa-edit-event-new-location', function () {
      active.newLocation = {slug: '', name: ''}
      active.event.location = active.newLocation
      refreshContent()
    })
    doc.on('click', '#spa-edit-event-choose-location', function () {
      active.newLocation = null
      active.event.location = active.locations[0]
      refreshContent()
    })
    doc.on('input', '#spa-edit-event-new-location-slug', function () {
      active.newLocation.slug = jQuery('#spa-edit-event-new-location-slug').val()
      refreshHeaderAndFooter()
    })
    doc.on('input', '#spa-edit-event-new-location-name', function () {
      active.newLocation.name = jQuery('#spa-edit-event-new-location-name').val()
      refreshHeaderAndFooter()
    })

    const eventDetailsForEdit = (function () {
      const whenForEdit = (function () {
        const template = `<ul>
          {{#occurrences}}<li>{{start}} <button class="btn btn-secondary btn-sm spa-delete-occurrence">Supprimer</button></li>{{/occurrences}}
          <li><input id="spa-new-occurrence" type="text" placeholder="Format&nbsp;: 2018-07-14T12:00"/> <button id="spa-add-occurrence" class="btn btn-secondary btn-sm" disabled="disabled">Ajouter</button></li>
        </ul>`

        function render ({event: {occurrences}}) {
          return mustache.render(template, {occurrences})
        }

        return {render}
      }())

      const whatForEdit = (function () {
        const template = '<div class="form-group"><label>Catégorie principale&nbsp;: <select id="spa-edit-event-main-tag">{{#tags}}<option value="{{slug}}"{{#isMain}} selected="selected"{{/isMain}}>{{title}}</option>{{/tags}}</select></label></div>' +
          '<p>Catégories secondaires&nbsp;:</p>' +
          '<ul>{{#tags}}{{^isMain}}<li><label>{{title}} <input class="spa-edit-event-secondary-tag" type="checkbox" value="{{slug}}"{{#isSecondary}} checked="checked"{{/isSecondary}} /></label></li>{{/isMain}}{{/tags}}</ul>' +
          '<div class="form-group"><label>Titre&nbsp;: <input id="spa-edit-event-title" value="{{title}}" /></label></div>' +
          '<div class="form-group"><label>Choisir un artiste&nbsp;: <select id="spa-edit-event-artist"><option value="-">-</option>{{#artists}}<option value="{{slug}}"{{#selected}} selected="selected"{{/selected}}>{{name}}</option>{{/artists}}</select></label></div>'

        function render ({event: {tags: eventTags, artist, title}}) {
          const artists = active.artists.map(({slug, name}) => (
            {slug, name, selected: artist && slug === artist.slug}
          ))

          const mainTag = eventTags[0].slug
          const secondaryTags = new Set(eventTags.slice(1).map(({slug}) => slug))

          const tags = active.tags.map(({slug, title}) => (
            {slug, title, isMain: slug === mainTag, isSecondary: secondaryTags.has(slug)}
          ))

          return mustache.render(template, {tags, title, artists})
        }

        return {render}
      }())

      const whereForEdit = (function () {
        const templateForChoose =
          '<div class="form-group"><label>Choisir un lieu existant&nbsp;: <select id="spa-edit-event-location">{{#locations}}<option value="{{slug}}"{{#selected}} selected="selected"{{/selected}}>{{name}}</option>{{/locations}}</select></label></div>' +
          '<div class="form-group"><label>Ou&nbsp;: <button id="spa-edit-event-new-location" class="btn btn-secondary btn-sm">Ajouter un nouveau lieu</button></label></div>'

        const templateForNew =
          '<p>Ajouter un nouveau lieu&nbsp;:</p>' +
          '<div class="form-group"><label>Slug&nbsp;: <input id="spa-edit-event-new-location-slug" value="{{slug}}"/></label></div>' +
          '<div class="form-group"><label>Nom&nbsp;: <input id="spa-edit-event-new-location-name" value="{{name}}"/></label></div>' +
          '<div class="form-group"><label>Ou&nbsp;: <button id="spa-edit-event-choose-location" class="btn btn-secondary btn-sm">Choisir un lieu existant</button></label></div>'

        function render ({event: {location}}) {
          if (active.newLocation) {
            return mustache.render(templateForNew, active.newLocation)
          } else {
            const locations = active.locations.map(({slug, name}) => {
              return {slug, name, selected: slug === location.slug}
            })

            return mustache.render(templateForChoose, {locations})
          }
        }

        return {render}
      }())

      function forEditPreview ({isEditing, idSuffix, forEdit, forDisplay}) {
        function render (data) {
          if (isEditing()) {
            return forEdit.render(data)
          } else {
            return forDisplay.render(data)
          }
        }

        const postTitleTemplate = ' <button id="spa-edit-event-edit-preview-{{idSuffix}}" class="btn btn-secondary btn-sm">{{display}}</button>'

        function renderPostTitle () {
          return mustache.render(
            postTitleTemplate,
            {
              idSuffix,
              display: isEditing() ? 'Prévisualiser' : 'Modifier'
            }
          )
        }

        return {render, renderPostTitle}
      }

      return eventDetails_.make({
        when: forEditPreview({
          isEditing: () => active.editingWhen,
          idSuffix: 'when',
          forEdit: whenForEdit,
          forDisplay: whenForDisplay
        }),
        what: forEditPreview({
          isEditing: () => active.editingWhat,
          idSuffix: 'what',
          forEdit: whatForEdit,
          forDisplay: whatForDisplay
        }),
        where: forEditPreview({
          isEditing: () => active.editingWhere,
          idSuffix: 'where',
          forEdit: whereForEdit,
          forDisplay: whereForDisplay
        })
      })
    }())

    deactivate()

    return {activate}

    async function activate ({citySlug, eventId}) {
      const {artists, city: {locations, tags, event}} = await request({
        requestString: 'query($citySlug:ID!, $eventId:ID!){artists{slug name} city(slug:$citySlug){locations{slug name} tags{slug title} event(id:$eventId){id title location{slug name} tags{slug title} artist{slug name} occurrences{start}}}}',
        variableValues: {citySlug, eventId}
      })

      const artistsBySlug = {}
      artists.forEach(artist => { artistsBySlug[artist.slug] = artist })

      const locationsBySlug = {}
      locations.forEach(location => { locationsBySlug[location.slug] = location })

      const tagsBySlug = {}
      tags.forEach(tag => { tagsBySlug[tag.slug] = tag })

      active = {
        citySlug,
        artists,
        artistsBySlug,
        locations,
        locationsBySlug,
        tags,
        tagsBySlug,
        event,
        editingWhen: false,
        editingWhat: false,
        editingWhere: false,
        newLocation: null
      }

      refreshContent()
      modal.modal('show')
    }

    function refreshContent ({body} = {body: true}) {
      const focusedId = document.activeElement.id
      modal.find('.modal-body').html(eventDetailsForEdit.render({city: {slug: active.citySlug}, event: active.event}))
      if (focusedId) {
        modal.find('#' + focusedId).focus()
      }
      refreshHeaderAndFooter()
    }

    function refreshHeaderAndFooter () {
      modal.find('.modal-title').text(active.event.title)
      const message = validateEvent()
      modal.find('#spa-modify-event-message').text(message)
      jQuery('#spa-modify-event-save').attr('disabled', message !== '')
    }

    function validateEvent () {
      if (active.event.occurrences.length === 0) {
        return 'Il faut au moins une représentation'
      } else if (!active.event.title && !active.event.artist) {
        return 'Il faut un titre ou un artiste'
      } else if (active.newLocation && !active.newLocation.slug.match(/[-a-z]+/)) {
        return "Le slug d'un nouveau lieu doit être constitué d'un ou plusieurs caractères parmi 'a-z', '0-9' et '-'"
      } else if (active.newLocation && !active.newLocation.name) {
        return "Le nom d'un nouveau lieu ne peut pas être vide"
      } else {
        return ''
      }
    }

    async function save () {
      const hasLocation = !!active.newLocation

      const location = active.newLocation || {slug: '', name: ''}
      location.citySlug = active.citySlug

      const event = {
        citySlug: active.citySlug,
        eventId: active.event.id,
        title: active.event.title,
        artist: active.event.artist && active.event.artist.slug,
        location: active.event.location.slug,
        tags: active.event.tags.map(({slug}) => slug),
        occurrences: active.event.occurrences
      }

      await request({
        requestString: `mutation($hasLocation:Boolean!,$location:ILocation!,$event:IEvent!){
          putLocation(location:$location)@include(if:$hasLocation){slug}
          putEvent(event:$event){id}
        }`,
        variableValues: {hasLocation, location, event}
      })

      modal.modal('hide')

      eventsFilter.refreshContent()
    }

    function deactivate () {
      active = null
    }
  }())

  const eventsFilter = (function () {
    var active
    const filter = jQuery('#spa-events-filter')
    const filteredEvents = jQuery('#spa-filtered-events')
    const filterTag = jQuery('#spa-filter-tag')
    const filterLocation = jQuery('#spa-filter-location')
    const filterArtist = jQuery('#spa-filter-artist')
    const filterDate = jQuery('#spa-filter-date')
    const filterTitle = jQuery('#spa-filter-title')

    filterTag.on('change', refreshContent)
    filterLocation.on('change', refreshContent)
    filterArtist.on('change', refreshContent)
    var filterTitleTimeoutId = null
    filterTitle.on('input', () => {
      clearTimeout(filterTitleTimeoutId)
      filterTitleTimeoutId = setTimeout(refreshContent, 200)
    })
    var filterDateTimeoutId = null
    filterDate.on('input', () => {
      clearTimeout(filterDateTimeoutId)
      filterDateTimeoutId = setTimeout(refreshContent, 200)
    })

    doc.on('click', '.spa-modify-event', function () {
      const eventId = jQuery(this).data('spa-event-id')
      eventEditor.activate({citySlug: active.citySlug, eventId})
    })

    deactivate()

    return {activate, deactivate, refreshContent}

    async function activate ({citySlug, eventId}) {
      deactivate()
      active = {citySlug}

      const data = await request({
        requestString: 'query($citySlug:ID!){artists{slug name} city(slug:$citySlug){tags{slug title} locations{slug name}}}',
        variableValues: {citySlug}
      })

      // Maybe use a https://jqueryui.com/autocomplete/#combobox for these selects
      fillSelect(filterTag, data.city.tags.map(({slug, title}) => ({value: slug, display: title})))
      fillSelect(filterLocation, data.city.locations.map(({slug, name}) => ({value: slug, display: name})))
      fillSelect(filterArtist, data.artists.map(({slug, name}) => ({value: slug, display: name})))
      filterDate.val('')
      filterTitle.val('')

      displayDisclaimer()

      filter.show()
      filteredEvents.show()

      if(isDebug) {
        filterTag.val('tag-1').trigger('change')
        eventEditor.activate({citySlug: active.citySlug, eventId: 'WjnegYbwZ1'})
      }
    }

    function deactivate () {
      active = null
      filter.hide()
      filteredEvents.hide()
    }

    async function refreshContent () {
      const tag = filterTag.val()
      const location = filterLocation.val()
      const artist = filterArtist.val()
      const date = moment(filterDate.val(), moment.HTML5_FMT.DATE, true)
      const title = filterTitle.val()

      var dates
      if (date.isValid()) {
        dates = {
          start: date.format(moment.HTML5_FMT.DATE),
          after: date.clone().add(1, 'day').format(moment.HTML5_FMT.DATE)
        }
      }

      const filter = {
        tag: tag === '-' ? undefined : tag,
        location: location === '-' ? undefined : location,
        artist: artist === '-' ? undefined : artist,
        title: title === '' ? undefined : title,
        dates
      }

      if (Object.values(filter).some(x => x)) {
        const {city: {events}} = await request({
          requestString: 'query($citySlug:ID!,$tag:ID,$location:ID,$artist:ID,$title:String,$dates:IDateInterval){city(slug:$citySlug){events(tag:$tag,location:$location,artist:$artist,title:$title,dates:$dates){id title artist{name} location{name} occurrences{start} tags{slug title}}}}',
          variableValues: Object.assign({citySlug: active.citySlug}, filter)
        })

        if (events.length) {
          displayEvents(events)
        } else {
          displayNoMatchingEvents()
        }
      } else {
        displayDisclaimer()
      }
    }

    function displayEvents (events) {
      filteredEvents.html(mustache.render(
        eventsTemplate,
        {
          events: events.map(({id, title, tags, artist, location, occurrences}) => {
            const event = {id, title, location, tags, artist, occurrences}

            event.details = {html: eventDetailsForDisplay.render({city: {slug: active.citySlug}, event})}

            return event
          })
        }
      ))
    }

    function displayNoMatchingEvents () {
      filteredEvents.html('<p>Aucun événement ne correspond.</p>')
    }

    function displayDisclaimer () {
      filteredEvents.html('<p>Utiliser le filtre sur la gauche pour afficher les événements qui correspondent.</p>')
    }
  }())

  const selectCity = jQuery('#spa-select-city')

  fillSelect(
    selectCity,
    (await request({requestString: '{cities{slug name}}'})).cities.map(({slug, name}) => ({
      value: slug,
      display: name
    }))
  )

  selectCity.on('change', () => {
    const citySlug = selectCity.val()
    if (citySlug === '-') {
      eventsFilter.deactivate()
    } else {
      eventsFilter.activate({citySlug})
    }
  })

  if(isDebug) {
    selectCity.val('avalon').trigger('change')
  }
}

Object.assign(exports, {render, initialize})
