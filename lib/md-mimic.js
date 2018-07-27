const Grit = require('../grit.js')

// simple quotes may be good enough, but its not really markdown..

// the CommonMark standard for markdown notations is quite a bit different
// but trying to be fully comptible is just repeating others mistakes.

module.exports = function (symb) {
	if (symb === '*') return span(this, /^([^*]*)[*]/)
	if (symb === '**') return span(this, /^([\s\S]*?)[*]{2}/)
	if (symb === '`') return backticks(this)
}

const span = function (that, rex) {
	var sx = that.input.match(rex)
	if (!sx) return null
	that.advance(sx[0].length)
	return that.prose(sx[1], that.env)
}

const backticks = function (that) {
	var src = that.input
	var sx = src.match(/^(?!`)\s*([\s\S]*?[^`]?)`(?!`)/)
	if (!sx) sx = src.match(/^(`*)\s*([\s\S]*?[^`]?)\s*`\1(?!`)/)
	if (!sx) return null
	that.advance(sx[0].length)
	return esc(sx[2]||sx[1])
}

const esc = (s) => s? s.replace(/&/g,'&amp;').replace(/</g,'&lt;') : ''
