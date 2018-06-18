import datetime
import os

import jinja2


class Colors:
    def __init__(
        self,
        *,
        primary_very_light,
        primary_light,
        primary,
        primary_dark,
        primary_very_dark,
        complement_very_light,
        complement_light,
        complement,
        complement_dark,
        complement_very_dark,
    ):
        assert isinstance(primary_very_light, str)
        self.__primary_very_light = primary_very_light
        assert isinstance(primary_light, str)
        self.__primary_light = primary_light
        assert isinstance(primary, str)
        self.__primary = primary
        assert isinstance(primary_dark, str)
        self.__primary_dark = primary_dark
        assert isinstance(primary_very_dark, str)
        self.__primary_very_dark = primary_very_dark
        assert isinstance(complement_very_light, str)
        self.__complement_very_light = complement_very_light
        assert isinstance(complement_light, str)
        self.__complement_light = complement_light
        assert isinstance(complement, str)
        self.__complement = complement
        assert isinstance(complement_dark, str)
        self.__complement_dark = complement_dark
        assert isinstance(complement_very_dark, str)
        self.__complement_very_dark = complement_very_dark

    @property
    def primary_very_light(self):
        return self.__primary_very_light

    @property
    def primary_light(self):
        return self.__primary_light

    @property
    def primary(self):
        return self.__primary

    @property
    def primary_dark(self):
        return self.__primary_dark

    @property
    def primary_very_dark(self):
        return self.__primary_very_dark

    @property
    def complement_very_light(self):
        return self.__complement_very_light

    @property
    def complement_light(self):
        return self.__complement_light

    @property
    def complement(self):
        return self.__complement

    @property
    def complement_dark(self):
        return self.__complement_dark

    @property
    def complement_very_dark(self):
        return self.__complement_very_dark


class Tag:
    def __init__(self, *, slug, title, border_color, background_color):
        assert isinstance(slug, str)
        self.__slug = slug
        assert isinstance(title, str)
        self.__title = title
        assert isinstance(border_color, str)
        self.__border_color = border_color
        assert isinstance(background_color, str)
        self.__background_color = background_color

    @property
    def slug(self):
        return self.__slug

    @property
    def title(self):
        return self.__title

    @property
    def border_color(self):
        return self.__border_color

    @property
    def background_color(self):
        return self.__background_color


class City:
    def __init__(self, *, slug, name, tags):
        assert isinstance(slug, str)
        self.__slug = slug
        assert isinstance(name, str)
        self.__name = name
        assert isinstance(tags, list)
        assert all(isinstance(tag, Tag) for tag in tags)
        self.__tags = tags

    @property
    def slug(self):
        return self.__slug

    @property
    def name(self):
        return self.__name

    @property
    def tags(self):
        return self.__tags


class Week:
    def __init__(self, start_date):
        assert isinstance(start_date, datetime.date)
        self.__start_date = start_date

    @property
    def slug(self):
        return self.__start_date.strftime("%G-W%W")

    @property
    def start_date(self):
        return self.__start_date


def _format_date(d):
    months = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ]
    days = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
    return d.strftime("{} %d {} %Y".format(days[d.weekday()], months[d.month - 1]))


def _format_time(t):
    if t.minute:
        format = "%Hh%M"
    else:
        format = "%Hh"
    return t.strftime(format)


class _Template:
    def __init__(self):
        self.environment = jinja2.Environment(
            loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
            trim_blocks=True,
            lstrip_blocks=True,
            undefined=jinja2.StrictUndefined,
        )
        self.environment.filters["format_date"] = _format_date
        self.environment.filters["format_time"] = _format_time

    def render(self):
        os.makedirs(os.path.dirname(self.destination), exist_ok=True)
        with open(self.destination, "w") as f:
            f.write(self.environment.get_template(self.template_name).render(self.context))
            f.write("\n")

    @property
    def destination(self):
        return "docs"

    @property
    def context(self):
        return dict()


class StyleCss(_Template):
    template_name = "style.css"

    def __init__(self, *, modernizr_features, colors):
        super().__init__()
        assert isinstance(modernizr_features, list)
        assert all(isinstance(feat, str) for feat in modernizr_features)
        self.__modernizr_features = modernizr_features
        assert isinstance(colors, Colors)
        self.__colors = colors

    @property
    def destination(self):
        return os.path.join(super().destination, "style.css")

    @property
    def context(self):
        return dict(
            colors=self.__colors,
            modernizr_features=self.__modernizr_features,
            **super().context,
        )


class _BaseHtml(_Template):
    pass


class IndexHtml(_BaseHtml):
    template_name = "index.html"

    def __init__(self, *, cities):
        super().__init__()
        assert isinstance(cities, list)
        assert all(isinstance(city, City) for city in cities)
        self.__cities = cities

    @property
    def destination(self):
        return os.path.join(super().destination, "index.html")

    @property
    def context(self):
        return dict(
            cities=self.__cities,
            **super().context,
        )


class AdsHtml(_BaseHtml):
    template_name = "ads.html"

    @property
    def destination(self):
        return os.path.join(super().destination, "ads", "index.html")


class _BaseWithinCityHtml(_BaseHtml):
    def __init__(self, *, city):
        super().__init__()
        assert isinstance(city, City)
        self.__city = city

    @property
    def destination(self):
        return os.path.join(super().destination, self.__city.slug)

    @property
    def context(self):
        return dict(
            city=self.__city,
            **super().context,
        )


class CityHtml(_BaseWithinCityHtml):
    template_name = "city.html"

    def __init__(self, *, city):
        super().__init__(city=city)

    @property
    def destination(self):
        return os.path.join(super().destination, "index.html")


class WeekHtml(_BaseWithinCityHtml):
    template_name = "week.html"

    def __init__(self, *, city, week):
        super().__init__(city=city)
        assert isinstance(week, Week)
        self.__week = week

    @property
    def destination(self):
        return os.path.join(super().destination, self.__week.slug, "index.html")

    @property
    def context(self):
        return dict(
            week=self.__week,
            **super().context,
        )
