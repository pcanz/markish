const Grit = require('./grit.js')

const extend = (env) =>
	({
		parent: env,
		label: {},
		sigil: {}
	})

const lookup = function lookup(key, type, env) {
	var def = env[type][key]
	if (def) return def;
	if (env.parent) return lookup(key, type, env.parent)
	return null;
}

var ish = Grit`
	ish   := (defn / fence / bulk)*             :: flatten

	defn  :~ %label (%html)? %sp (%body) %nl?   :: define
	label :~ (\S+) %sp [=] %sp (?=[<&])
	html  :~ < \S+ [^>\n\r]* > | &[^;\s]+;
	body  :~ %line (?: %blank* %tab %line)*

	fence :~ (%start) %info %field %end   :: (_,f,info,field) => ({info, field})
	start :~ [\`]{3,}|[~]{3,}
	info  :~ \s* (%line) %nl
	field :~ ((?:(?!\1)%line%nl?)*)
	end   :~ (?:%nl \1 |$)

	bulk  :~ (?: %blank* %skip*)*                :: (bulk) => ({bulk})
	skip  :~ (?!%label) (?!%start) %line
	line  :~ [^\n\r]*
	blank :~ %sp %nl
	tab   :~ \t | [ ]{2}
	sp    :~ [ \t]*
	nl    :~ \n | \r\n?
`;
ish.define = function (_, label, html, transform) {
	// console.log(label,html,transform)
	var def = {html, label, transform}
	if (!html) def.html = "<pre class='bad defn'>"
	if (label[0] === '(' && label[label.length-1] === ')')
		this.env.sigil[label.slice(1,-1)] = def
	else {
		def.label = label
		this.env.label[label] = def
	}
	return [];
}

var blocks = Grit`
	blks  := (blank / block / para)*        :: flatten
	block := defn body nl?                  :: block
	para  := text (nl !blank !defn line)*   :: para
	defn   :~ (\S*) %blank? (?:\t|[ ]{2,4}) :: defn
	body  :~ %line (%blank* %inset %line)*
	text  :~ [ \t]* [^\n\r]+
	line  :~ [^\n\r]*
	inset :~ [ \t]
	blank :~ [ \t]* %nl
	nl    :~ \n | \r \n?
`;
blocks.defn = function (_, label) { // fail block if label undefined
	return (lookup(label, 'label', this.env) || null)
}
blocks.block = function (def, content) {
	var src = content.replace(/(\n)([ ]{1,4}|\t)/g,'\n')
	def.type = 'block'
	return render(def, src, this)
}
blocks.para = function (line, lines) {
	var p = line+this.flatten(lines).join('')
	// if (p.length === this.input.length)
	// 	return prose(p,this.env)
	return `<p>${prose(p,this.env)}</p>`;
}

var prim = Grit`
	prim   := (elem / words / symb / skip)*   :: flatten
	elem    := label content                  :: element
	content := paren / sqr                    :: (c) => c
	paren   := '(' (paren / ptxt)* ')'        :: string
	ptxt    :~ [^()]*
	sqr     := '[' (sqr / stxt)* ']'          :: string
	stxt    :~ [^\[\]]*
	label   :~ ([^\s\[\]()]+) (?=%open)       :: defn
	open    :~ [(\[]
	text    :~ [^()\[\]]*
	words   :~ ([a-zA-Z0-9]+ [\s]+)+
	symb    :~ ([^a-zA-Z0-9\[\]()\s]+) ([^\[\]()\s.,]*)  :: symbol
	skip    :~ [a-zA-Z0-9]+ | [\s\S]
`;
prim.skip = function(c) {
	console.log(c)
	return c
}
prim.defn = function (_, label) { // fail elem if label undefined
	var def = lookup(label, 'label', this.env)
	if (!def) return null; // fail
	return def
}
prim.element = function (def, content) { //}, close) {
	// console.log('elem', def, content)
	content = content.slice(1,-1)
	return render(def, content, this)
}
prim.symbol = function (symb) {
	var def = lookup(symb, 'sigil', this.env)
	var n = symb.length  // logest prefix match....
	while (!def && n>1) def = lookup(symb.slice(0,n-=1), 'sigil', this.env)
	var key = symb.slice(0,n)
	this.pos -= symb.length-key.length
	if (!def) return esc(key)
	if (def.html[0] === '&') return def.html // ignores transform
	var htag = def.html.match(/^<([^ />]*)/)[1]
	if (!def.transform)	return `${def.html}${esc(key)}</${htag}>}`
	var html = transform(def, key, this);
	if (html) return `${def.html}${html}</${htag}>`
	return esc(key)
}

const render = function (def, content, parser) {
	var env = parser.env
	var html = null;
	if (def.html[0] === '<') {
		var htag = def.html.match(/^<([^ />]*)/)[1]
		if (def.transform) html = transform(def, content, parser);
		else if (hcontent[htag]) html = hcontent[htag](content)
		else if (def.type === 'block') html = markish(content, env)
		else html = prose(content, env);
		if (def.html.match(/\/>$/)) return `${def.html}`
		return `${def.html}${html}</${htag}>`
	}
	if (def.html[0] === '&' && !def.transform) {
		if (!content) return def.html
		return `[${def.html} ${prose(content, env)}]`;
	}
	throw new Error('Bad definition: '+def);
}

const esc = (s) => s? s.replace(/&/g,'&amp;').replace(/</g,'&lt;') : ''

const hcontent = {
	style: (content) => content.replace(/<\/style>/g,'<\\/style>'),
	script: (content) => content.replace(/<\/script>/g,'<\\/script>'),
	textarea: (content) => content.replace(/<\/textarea>/g,'<\\/textarea>')
}

var modules = {} // cache loaded modules

const transform = function (def, content, parser) {
	var env = parser.env
	var input = parser.input.slice(parser.pos)
	var advance = function (n) { parser.pos += n }
 	var ctx = {markish, prose, def, env, input, advance}
	try {
		var [mod,fn] = def.transform.split(/\s+/) // e.g.: ./lib/module.js fn
		var fun = builtin[mod]
		if (fun) return fun.call(ctx, content)
		var loaded = modules[mod] || require(mod)
		var func = fn? loaded[fn] : loaded
		if (typeof func !== 'function') console.log(loaded)
		var html = func.call(ctx, content)
		if (!modules[mod]) { // first time...
			modules[mod] = loaded  // cache
			html += loaded.css || ''   // once
		}
		return html
	} catch(err) {
		// console.log('err content', content)
		var msg = ' *** Transform: '+JSON.stringify(def)+' failed: '+err.message
		return fault(def, content, msg)
	}
}

const builtin = {
	text: (content) => esc(content),
	raw: (content) => content,
	value: function (content) {
		this.def.html = this.def.html.replace(/~value/,content)
		return esc(content)
	},
	quote: function (src) { // "..."
		var sx = this.input.match(/^([^"]*)"/)
		if (!sx) return null
		this.advance(sx[0].length)
		return `&ldquo;${this.prose(sx[1], this.env)}&rdquo;`
	},
	autolink: function (src) { // <url>
		var sx = this.input.match(/^([^\s>]*)>/)
		if (!sx) return null
		this.advance(sx[0].length)
		return `<a href='${sx[1]}'>${sx[1]}</a>`
	}
}

const fault = function(def, content, msg) {
	console.log('fault: '+msg+def)
	var src = content.replace(/&/g,'&amp;').replace(/</g,'&lt;')
	var red = `style='border:thin solid red;'`
	if (def.type === '{') return `<pre class='err'${red}>${src}<hr>${msg}</pre>`;
	return `<pre><mark class='err'${red}>${src}</mark></pre>`;
}

// == Markish API ===================================================================

var prose = (src, env) => prim.parse(src, env).join('')

var markish = (src, env) => {
	// if (!src.match(/(?:\n|\r\n?)[ \t]*(?:\n|\r\n?)/))
	// 	return prose(src, env)
	var env = extend(env)
	var ast = ish.parse(src, env)
	var terms = ast.map((t) => {
		if (t.bulk) {
			var blks = blocks.parse(t.bulk, env)
			return blks.join('')
		}
		if (t.def) return '';
		return t;
	});
	// console.log(env)
	return terms.join('');
}


module.exports = markish;


// console.log(markish(tst))

// == simple test source text to use if called from command line without a source file =============

var testish = `
##  Test (No file was specified)

Some *(italics) and **(bold) text,
and a second line.

Try -> and *[italic **[bold] text] and test[*[emph]].

-  Item one.
-  Item two.

demo  *(emphasis)

#  = <h1>
## = <h2>
-  = <li>

*  = <i>
** = <b>
_  = <u>

test = <test> text
(->) = &rarr;

code
	a<b c>d

script
	console.log('<script>Bye bye..</script>')

script = <script>


eg = <div class='eg'> ./lib/demo.js eg
demo = <div class='demo'> ./lib/demo.js demo
demo-html = <div class='demo'> ./lib/demo.js demo_html

`;

// == command line markish file translator ==================================================

var fs = require('fs')

var file_in = process.argv[2];
if (!file_in) {
	console.log(markish(testish))
	process.exit(-1)
}
var file_out = process.argv[3] || file_in+'.html';

var src = fs.readFileSync(file_in)

var html = markish(src.toString())

var doc = `
<!DOCTYPE HTML>
<html>
<head>
    <meta lang=en charset="UTF-8">
<body>
${html}
</body>
</html>
`;

fs.writeFileSync(file_out,doc)
