<template>
  <sp-layout title="Splight" lead="Votre agenda culturel régional">
    <template v-slot:content>
      <b-row>
        <b-col v-for="city in cities" :key="city.slug" cols="6" md="3">
          <p><router-link :to="{name: 'city', params: {citySlug: city.slug}}"><b-img fluid :alt="city.name" :src="city.image" /></router-link></p>
          <p><router-link :to="{name: 'city', params: {citySlug: city.slug}}">{{ city.name }}</router-link></p>
        </b-col>
      </b-row>
    </template>
  </sp-layout>
</template>

<script>
import gql from 'graphql-tag'

export default {
  data () {
    return {
      cities: {}
    }
  },
  apollo: {
    cities: gql`{cities{slug name image}}`
  }
}
</script>
