
module.exports.eg = (src) => `<pre class='demo-left'>${esc(src)}</pre>`

module.exports.demo = function (src) {
	return show(esc(src), this.markish(src, this.env))
}

module.exports.demo_html = (src) => show(esc(src), src)

const esc = (s) => s? s.replace(/&/g,'&amp;').replace(/</g,'&lt;') : ''

const show = (left, right) =>
`<table class='demo'>
  <tr>
	<td class='demo-left'>${left}</td>
	<td class='demo-right'>${right}</td>
  </tr>
</table>
`;

module.exports.css = `
<style>
  table.demo {width:100%; margin-left:5pt; }
  .demo-left {font-family: monospace; background:whitesmoke;
	   margin: 5pt; padding: 5pt; }
  td.demo-left {white-space:pre;  width:50%;}
  td.demo-right {margin:5pt; padding: 5pt; vertical-align:top;}
</style>
`;
