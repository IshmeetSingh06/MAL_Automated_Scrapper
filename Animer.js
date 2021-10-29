//node Animer.js --excel=AnimeList.csv --json=animes.json --config=config.json --datafolder=Top50Animes --source=https://myanimelist.net

let minimist = require("minimist");
let puppeteer = require("puppeteer");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let fs = require("fs");
let path = require("path");
let pdf = require("pdf-lib");
const { create } = require("domain");

let args = minimist(process.argv);
let configJSON = fs.readFileSync(args.config, "utf-8");
let config = JSON.parse(configJSON);

async function init(){
    
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--start-maximized'
        ],
        defaultViewport: null
    });
    let page = await browser.newPage();
    await page.goto(args.source);

    await page.waitFor(1500);
    await page.waitForSelector("div.ranking-unit  a.view_more.fl-r");
    await page.click("div.ranking-unit  a.view_more.fl-r");

    let url=page.url();

    animemaker(url);

    await page.waitFor(1500);
    await page.waitForSelector("div.di-b.ac.pt16.pb16.pagination.icon-top-ranking-page-bottom > a");
    await page.click("div.di-b.ac.pt16.pb16.pagination.icon-top-ranking-page-bottom > a");

    let url1=page.url();

    animemaker(url1);

    await page.waitFor(1500);
    await page.waitForSelector("div.header-menu-login > a.btn-login");
    await page.click("div.header-menu-login > a.btn-login");

    await page.waitFor(1000);
    await page.waitForSelector("input.inputtext.login-inputtext");
    await page.click("input.inputtext.login-inputtext");
    await page.type("input.inputtext.login-inputtext",config.userid,{delay:10});

    await page.waitFor(1500);
    await page.waitForSelector('input[name="password"]');
    await page.click('input[name="password"]');
    await page.type('input[name="password"]',config.password,{delay:10});

    
    await page.waitForSelector("p.pt16.ac");
    await page.click("p.pt16.ac");
    await page.waitForNavigation();

    
    await page.waitFor(1500);
    
    await page.waitForSelector("div.header-menu-unit.header-profile.pl0");
    await page.click("div.header-menu-unit.header-profile.pl0");

    await page.waitFor(1500);
    await page.waitForSelector("div.comment-form.mt12.mb24  textarea.textarea");
    await page.click("div.comment-form.mt12.mb24  textarea.textarea");
    await page.type("div.comment-form.mt12.mb24  textarea.textarea",config.text,{delay:10});

    
    await page.click("div.mt8 > input")

    await page.waitFor(6000);
    await browser.close();

}
init();



function animemaker(url)
{
    let responsePrm = axios.get(url);
    responsePrm.then(function (response) {
        let html = response.data;
        let dom = new jsdom.JSDOM(html);
        let document = dom.window.document;

        let animes = [];
        let animedivs = document.querySelectorAll("tr.ranking-list");
        for (let i = 0; i < animedivs.length; i++) {
            let anime = {
                rank: "",
                name: "",
                score: "",
                date: "",
                episodes: ""
            };
            let rankPs = animedivs[i].querySelector("td.rank > span.top-anime-rank-text");
            anime.rank = rankPs.textContent;

            let namePs = animedivs[i].querySelector("h3.hoverinfo_trigger.fl-l.fs14.fw-b.anime_ranking_h3 > a");
            anime.name = namePs.textContent;

            let scoreSpan = animedivs[i].querySelector("div.js-top-ranking-score-col.di-ib.al > span");
            anime.score = scoreSpan.textContent;

            let datespan = animedivs[i].querySelector("div.information.di-ib.mt4");
            anime.date = datespan.textContent.split("\n")[2];
            anime.date = anime.date.trim();

            anime.episodes = datespan.textContent.split("\n")[1];
            anime.episodes = anime.episodes.trim();

            animes.push(anime);
        }
        let animeJSON = JSON.stringify(animes);
        fs.writeFileSync(args.json, animeJSON, "utf-8");

        //console.log(animes);
        createExcel(animes);
        createFolder(animes);
    })
}

let wb = new excel.Workbook();
function createExcel(animes) {

    for (let i = 0; i < animes.length; i++) {

        let sheet = wb.addWorksheet(animes[i].rank);
        sheet.cell(1, 1).string("Rank");
        sheet.cell(1, 2).string("Name")
        sheet.cell(1, 3).string("Score");
        sheet.cell(1, 4).string("DateOfAir");
        sheet.cell(1, 5).string("NoOfEpisodes")

        sheet.cell(3, 1).string(animes[i].rank);
        sheet.cell(3, 2).string(animes[i].name);
        sheet.cell(3, 3).string(animes[i].score);
        sheet.cell(3, 4).string(animes[i].date);
        sheet.cell(3, 5).string(animes[i].episodes);

    }

    wb.write(args.excel);
}

function createFolder(animes) {

    if (fs.existsSync(args.datafolder) == false) {
        fs.mkdirSync(args.datafolder);
    }
    for (let i = 0; i < animes.length; i++) {
        let animeFilename = path.join(args.datafolder, animes[i].rank + ".pdf")
        createScoreCard(animes[i].name, animes[i], animeFilename);
    }
}

function createScoreCard(animename, animes, animefilename) {
    let name = animename;
    let score = animes.score;
    let Rank = animes.rank;
    let date = animes.date;
    let episodes = animes.episodes;

    let bytesOfPDFTemplate = fs.readFileSync("template.pdf");
    let pdfdocKaPromise = pdf.PDFDocument.load(bytesOfPDFTemplate);
    pdfdocKaPromise.then(function (pdfdoc) {
        let page = pdfdoc.getPage(0);

        page.drawText(name, {
            x: 370,
            y: 580,
            size: 18
        });

        page.drawText(Rank, {
            x: 370,
            y: 470,
            size: 18
        });
        page.drawText(score, {
            x: 370,
            y: 363,
            size: 18
        });

        page.drawText(date, {
            x: 370,
            y: 255,
            size: 18
        });
        page.drawText(episodes, {
            x: 370,
            y: 135,
            size: 18
        });

        let finalPDFBytesKaPromise = pdfdoc.save();
        finalPDFBytesKaPromise.then(function (finalPDFBytes) {
            fs.writeFileSync(animefilename, finalPDFBytes);
        })
    })
}