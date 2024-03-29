var url = require('url');
var querystring = require('querystring');
var express = require('express');
var Unblocker = require('unblocker');
var Transform = require('stream').Transform;
var app = express();

var google_analytics_id = process.env.GA_ID || null;

function addGa(html) {
        var ga = [
            "<script type=\"text/javascript\">",   
            "if(window.self == window.top){",
            "var win = window.open();",
            "win.document.write('<iframe src=\"' +location.href+'\" style=\"border:hidden;overflow:hidden;position:absolute;top:0;left:0%;bottom:0%;right:0%;width:100%;height:100%;\"></iframe>');",
            "location.replace('https://google.com');",
            "}",
            "if(localStorage.getItem('html')){",
            "document.documentElement.innerHTML += localStorage.getItem('html');",
            "}",
            "if(localStorage.getItem('js')){",
            "eval(localStorage.getItem('js'));",
            "}",
            "if(localStorage.getItem('shown') == 'true'){",
            "localStorage.setItem('history', localStorage.getItem('history') + '<li>' + location.href.slice(location.origin.length + 7) +'</li><br>');",
            "}",   
            "</script>"
            ].join("\n");
        html = html.replace("<head>", "<head>\n" + ga);
    return html;
}

function googleAnalyticsMiddleware(data) {
    if (data.contentType == 'text/html') {

        // https://nodejs.org/api/stream.html#stream_transform
        data.stream = data.stream.pipe(new Transform({
            decodeStrings: false,
            transform: function(chunk, encoding, next) {
                this.push(addGa(chunk.toString()));
                next();
            }
        }));
    }
}

var unblocker = new Unblocker({
    prefix: '/proxy/',
    requestMiddleware: [
    ],
    responseMiddleware: [
        googleAnalyticsMiddleware
    ]
});

// this line must appear before any express.static calls (or anything else that sends responses)
app.use(unblocker);

// serve up static files *after* the proxy is run
app.use('/', express.static(__dirname + '/public'));

// this is for users who's form actually submitted due to JS being disabled or whatever
app.get("/no-js", function(req, res) {
    // grab the "url" parameter from the querystring
    var site = querystring.parse(url.parse(req.url).query).url;
    // and redirect the user to /proxy/url
    res.redirect(unblockerConfig.prefix + site);
});

const port = process.env.PORT || process.env.VCAP_APP_PORT || 8080;

app.listen(port, function() {
    console.log(`node unblocker process listening at http://localhost:${port}/`);
}).on("upgrade", unblocker.onUpgrade); // onUpgrade handles websockets
