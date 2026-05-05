const cheerio = require('cheerio');

// Built-in sample HTML so the demo never fails due to network issues.
// Mirrors the markup style of a typical Pakistani doctor directory.
const SAMPLE_HTML = `
<html><body>
<div class="directory">
  <div class="doctor-card" data-pmc="PMC-A-001">
    <h2 class="doc-name">Dr. Imran Sheikh</h2>
    <div class="spec">Cardiologist</div>
    <div class="exp">15 years experience</div>
    <div class="city">Islamabad</div>
    <div class="fee">Rs. 3500</div>
    <p class="bio">Senior interventional cardiologist with 15+ years at PIMS, specializing in coronary care.</p>
  </div>
  <div class="doctor-card" data-pmc="PMC-A-002">
    <h2 class="doc-name">Dr. Hina Tariq</h2>
    <div class="spec">Dermatologist</div>
    <div class="exp">9 years experience</div>
    <div class="city">Karachi</div>
    <div class="fee">Rs. 2800</div>
    <p class="bio">Cosmetic and clinical dermatologist with a focus on adult acne and pigmentation.</p>
  </div>
  <div class="doctor-card" data-pmc="PMC-A-003">
    <h2 class="doc-name">Dr. Bilal Yousuf</h2>
    <div class="spec">Pediatrician</div>
    <div class="exp">11 years experience</div>
    <div class="city">Lahore</div>
    <div class="fee">Rs. 2000</div>
    <p class="bio">Children's health specialist working at Children's Hospital Lahore.</p>
  </div>
  <div class="doctor-card" data-pmc="PMC-A-004">
    <h2 class="doc-name">Dr. Saima Khalid</h2>
    <div class="spec">Gynecologist</div>
    <div class="exp">14 years experience</div>
    <div class="city">Faisalabad</div>
    <div class="fee">Rs. 3200</div>
    <p class="bio">OB-GYN with expertise in high-risk pregnancies and laparoscopic procedures.</p>
  </div>
  <div class="doctor-card" data-pmc="PMC-A-005">
    <h2 class="doc-name">Dr. Talha Munir</h2>
    <div class="spec">Orthopedic Surgeon</div>
    <div class="exp">7 years experience</div>
    <div class="city">Peshawar</div>
    <div class="fee">Rs. 4000</div>
    <p class="bio">Orthopedic surgeon — sports injuries and joint replacement.</p>
  </div>
</div>
</body></html>`;

// Parses a fragment of HTML using the .doctor-card pattern
const parseDirectory = (html) => {
    const $ = cheerio.load(html);
    const results = [];
    $('.doctor-card').each((_, el) => {
        const card = $(el);
        const pmc = card.attr('data-pmc') || '';
        const fullName = card.find('.doc-name').first().text().trim();
        const specialization = card.find('.spec').first().text().trim();
        const expRaw = card.find('.exp').first().text().trim();
        const expMatch = expRaw.match(/(\d+)/);
        const experience = expMatch ? parseInt(expMatch[1]) : 0;
        const city = card.find('.city').first().text().trim();
        const feeRaw = card.find('.fee').first().text().trim();
        const feeMatch = feeRaw.match(/(\d+)/);
        const fee = feeMatch ? parseInt(feeMatch[1]) : 0;
        const about = card.find('.bio').first().text().trim();
        if (fullName && pmc) {
            results.push({ pmc, fullName, specialization, experience, city, fee, about });
        }
    });
    return results;
};

// Fetches a remote directory and parses it. Falls back to SAMPLE_HTML when no
// URL is given OR when the network call fails (so the demo never breaks).
const fetchAndParse = async (url) => {
    if (!url) return parseDirectory(SAMPLE_HTML);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'DoctorLinkBot/1.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        return parseDirectory(html);
    } catch (err) {
        return { error: err.message, fallback: parseDirectory(SAMPLE_HTML) };
    }
};

module.exports = { fetchAndParse, parseDirectory, SAMPLE_HTML };
