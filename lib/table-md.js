
// Github multimarkdown style tables...

var test_eg  = `

	| A   |  B   |  C |
	|:--- |:----: | ---:|
	| d   | e\\|f |   g |

	  x   |  a *big* cat    | z
`;
// console.log( mdt.parse(test_eg) );

// The outside | markers are optional unless an empty field is required.
// blank lines are ignored
// if the second row is not a header alignment line then there is no header

const Grit = require('../grit.js')

module.exports = function (src) {
	return mdt.parse(src, this)
}

var mdt = Grit`
	file    := line+               :: table
	line    := record nl?          :: (r,_) => r
	record  := cell+               :: trim
	cell    := field '|'?          :: (f,_) => f.trim()
	field   := (esc / txt)*        :: (fs) => fs.join('')
	esc     :~ [\\] ([|])          :: (_,e) => e
	txt     :~ [^\\|\n\r]*
	nl      :~ \n | \r\n?
`;
mdt.table = function (lines) {
	var {prose, env} = this.env
	var rows = lines.filter((line)=>line.length)
	var hdx = rows[1].map((cell) => cell.match(/^\s*(:?)[ -]+(:?)\s*$/))
	var body = rows, html;
	if (hdx && hdx[0]) { // header dash-line |---|:--:|--:|
		var align = hdx.map((x)=>
			!x? 'left'
			: (x[1]&&x[2])? 'center'
			  : (x[2]? 'right'
			    : 'left')
		)
		html = `<tr>${
			body[0].map((cell,i) =>
				`<th class='${align[i]}'>${prose(cell,env)}</th>`).join('')
		}</tr>\n`;
		html += body.slice(2).map((row) =>
			`<tr>${row.map((cell,i) =>
				`<td class='${align[i]}'>${prose(cell,env)}</td>`).join('')
			}</tr>\n`).join('')
	} else { // no header...
		html = body.map((row) =>
			`<tr>${row.map((cell) =>
				`<td>${cell}</td>`)}</tr>\n`).join('')
	}
	return html // `<table>${html}</table>`;
}
mdt.trim = function (cells) {
	if (!cells.length) return cells;
	var i = 0, j = cells.length
	if (!cells[i].trim()) i += 1;
	if (!cells[j-1].trim()) j -= 1;
	return cells.slice(i,j)
}


// console.log( mdt.parse(`a | b | c
// d | e\\|f | g`));
//
// console.log( mdt.parse(`| a | b | c |
// | d | e\\|f | g |`));
//
// console.log( mdt.parse(`
// 	| a   |   b   |   c |
// 	|:--- |:----: | ---:|
//
// 	| d   | e\\|f |   g |
//
// `));
//
