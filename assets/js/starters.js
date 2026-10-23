/*!
 * LenChat - starters.js 
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 * Prompt starters shown in Settings -> "Prompt starters & examples". Each one shows what LenChat can do and
 * puts a ready prompt into the message box with one tap.
 *
 */
(function (global) {
    'use strict';

    global.LenStarters = { groups: [
        {
            id: 'docs', title: 'Documents you can download',
            blurb: 'PDF, Word and Excel files are built in your browser. The reply contains one file card with a Download button.',
            items: [
                { title: 'PDF report', note: 'Built-in PDF writer (A4, headings, lists, tables).',
                  prompt: 'Create a one-page PDF named "monthly-report" for a small agency: a title, a short summary paragraph, a bullet list of 4 highlights and a table of income vs expenses for 3 months (use sample numbers).' },
                { title: 'Word document', note: '.docx with headings, lists and tables.',
                  prompt: 'Write a Word document called "service-agreement" with a title, 6 numbered clauses for a web development contract (scope, payment, delivery, revisions, ownership, termination) and a signature table.' },
                { title: 'Excel workbook', note: 'Several sheets, header rows, sample data.',
                  prompt: 'Make an Excel file "cafe-sales" with two sheets: "Sales" (date, item, qty, price, total for 15 rows) and "Summary" (total per item). Use plain values, no formulas.' },
                { title: 'JSON / CSV data', note: 'Plain data files download with the right extension.',
                  prompt: 'Generate a products.json file with 8 sample products (id, name, price, category, inStock) and a matching products.csv file.' }
            ]
        },
        {
            id: 'code', title: 'Several files at once',
            blurb: 'With the File Generation Skill on, every file arrives in its own block with its own name. Use "Download all (.zip)" for the lot.',
            items: [
                { title: 'Landing page in 3 files', note: 'index.html + style.css + app.js, previewed together.',
                  prompt: 'Build a responsive landing page for a coffee shop as three separate files: index.html, style.css and app.js (a mobile menu toggle and a smooth-scroll). Link the CSS and JS from the HTML.' },
                { title: 'PHP + SQL starter', note: 'Several code files for a small CRUD.',
                  prompt: 'Give me a tiny PHP PDO notes app as separate files: config.php, db.sql, index.php (list + add form) and delete.php. Keep it under 120 lines in total.' },
                { title: 'Fix my attached project', note: 'Drop files or a folder first, then ask.',
                  prompt: 'Review the attached files for bugs and security problems. Return ONLY the files that need changes, each complete, in separate blocks.' }
            ]
        },
        {
            id: 'live', title: 'Live interactive previews',
            blurb: 'HTML, CSS and JavaScript run in a sandbox right under the reply. You can click inside the preview, edit the code and watch it update.',
            items: [
                { title: 'Playable game', note: 'Canvas game in one HTML file.',
                  prompt: 'Make a single-file HTML snake game with arrow keys and swipe controls, a score counter and a restart button.' },
                { title: 'Calculator tool', note: 'A small app with a console panel.',
                  prompt: 'Create an HTML tip and split-the-bill calculator with 3 inputs and a live result. Log each calculation with console.log.' },
                { title: 'Animated SVG', note: 'Vector art you can enlarge and download.',
                  prompt: 'Draw an SVG logo for "LenTech": a hexagon with a stylised L, a gradient and a subtle rotating animation.' }
            ]
        },
        {
            id: 'image', title: 'Pictures',
            blurb: 'Keyless generation through Pollinations, or OpenAI images when selected in Settings. Click any picture to enlarge it.',
            items: [
                { title: 'Generate an image', note: 'Starts with /imagine.',
                  prompt: '/imagine a neon-lit Nairobi street at night in the rain, cinematic, 35mm' },
                { title: 'Screenshot debugging', note: 'Paste or drop a screenshot, then ask.',
                  prompt: 'Look at the attached screenshot: what is wrong with this layout on mobile, and what CSS would fix it?' }
            ]
        },
        {
            id: 'voice', title: 'Talk to it',
            blurb: 'Tap the microphone and speak. Say "send it" after a pause to send, "clear the text" to start over, or "stop listening". Replies can be read aloud.',
            items: [
                { title: 'Explain by voice', note: 'Dictate, say "send it", then press Listen.',
                  prompt: 'Explain what a REST API is in four short sentences, as if I am new to programming.' },
                { title: 'Hands-free chat', note: 'Turn on Hands-free in Settings -> Voice.',
                  prompt: 'Quiz me with five quick questions about JavaScript arrays, one at a time. Wait for my spoken answer before the next one.' }
            ]
        }
    ] };
})(window);
