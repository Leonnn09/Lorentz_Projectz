/* =====================================================================
   Project Lorentz — Real life, simulated (CL.realsim).
   Four machines from the "In real life" stories, run with real physics
   and real numbers, inside the station they belong to:
     Gauss gun              → a maglev train (the Shanghai airport line)
                              and a jet catapult (EMALS or steam)
     Cyclotron              → PET medicine: a hospital cyclotron making fluorine-18
                              the aurora: one particle on Earth's field, or the whole solar wind
                              an electron microscope: the aurora's spiral inside a magnetic lens
     Collider               → a PET scanner: antimatter meeting matter inside a patient
     Cyclotron and Collider → the LHC: CERN's 27 km ring
   Each has a "Why is this here?" card that runs the station's physics
   next to the real machine's, with the student's own settings.
   The physics is in realsim-physics.js (REAL); this file draws it and
   gives it controls. Every real number is listed with its source.
   ===================================================================== */
(() => {
  'use strict';
  const { $, $$, clamp, TAU, DEG, reduceMotion, fitCanvas, skin, audio, bus, plot, bindRange, segInit, pl, si, en, store } = CL;
  const R = REAL, KN = R.C.kn, RE = R.EARTH.RE, G0 = R.C.g;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const mmss = t => { const s = Math.max(0, Math.round(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const F = (n, w = 600) => `${w} ${n}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const lamp = () => skin.c('--lamp');
  const simple = () => document.body.classList.contains('is-beginner');      // the Simple / Full switch in the top bar
  function glow(c, x, y, r, rgb, a = 1) { if (!(r > 0.5)) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function text(c, s, x, y, o = {}) { CL.haloText(c, s, x, y, { font: F(o.size || 13, o.weight || 600), align: o.align || 'left', base: o.base || 'middle', color: o.color || '#e6ece8', halo: o.halo || 3.5, haloColor: o.haloColor || 'rgba(4,7,9,0.88)' }); }
  function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  const lerp = (a, b, f) => a + (b - a) * f;
  function interp(tr, t, key = 't') {          // linear interpolation in a recorded trace
    if (!tr.length) return null;
    if (t <= tr[0][key]) return tr[0];
    let lo = 0, hi = tr.length - 1;
    if (t >= tr[hi][key]) return tr[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tr[m][key] <= t) lo = m; else hi = m; }
    const a = tr[lo], b = tr[hi], f = (t - a[key]) / (b[key] - a[key] || 1), o = {};
    for (const k in a) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], f) : a[k];
    return o;
  }

  /* ---------------- where the numbers come from ---------------- */
  const SRC = {
    shanghai: ['Wikipedia: Shanghai maglev train (30.5 km; 300 km/h in 2:15; trips 7:20 and 8:10)', 'https://en.wikipedia.org/wiki/Shanghai_maglev_train'],
    ieee: ['IEEE Spectrum: Faster than a speeding bullet train (up to 1.5 m/s², 300 km/h in about 5 km)', 'https://spectrum.ieee.org/faster-than-a-speeding-bullet-train'],
    dewe: ['Dewesoft: testing the world’s fastest train (153.6 m, 574 passengers, 505 km/h allowed)', 'https://dewesoft.com/blog/testing-worlds-fastest-train'],
    tri: ['Transrapid International: the Transrapid maglev system (10 mm gap, 150 mm clearance)', 'https://www.ncl.ac.uk/media/wwwnclacuk/pressoffice/files/pressreleaseslegacy/TRI_Flug_Hoehe_e_5_021.pdf', 'Transrapid International'],
    wctr: ['WCTR 1992: the Transrapid’s long-stator propulsion (0 to 270 Hz)', 'https://wctrs-society.com/wp-content/uploads/abstracts/lyon/Segment%20062%20of%20WCTR92_Lyon%20_Vol4.pdf'],
    meis: ['Meisinger: 40 years of maglev vehicles in Germany (Transrapid 06: 120 t)', 'https://opus4.kobv.de/opus4-ohm/files/44/Meisinger_40years_MAGLEV.pdf'],
    transrapid: ['Wikipedia: Transrapid (levitation and guidance about 1.7 kW per tonne)', 'https://en.wikipedia.org/wiki/Transrapid'],
    maglev: ['Wikipedia: Maglev (603 km/h record, drag takes most of the energy)', 'https://en.wikipedia.org/wiki/Maglev'],
    stator: ['Patent CA 2308267: a long-stator winding divided into sections, e.g. about 1.2 km long, each fed from a substation', 'https://brevets-patents.ic.gc.ca/opic-cipo/cpd/eng/patent/2308267/summary.html'],
    emals: ['Wikipedia: Electromagnetic Aircraft Launch System (91 m, 45,000 kg to 130 kn, 90 % vs 5 %, 95 MJ, 610 kg of steam)', 'https://en.wikipedia.org/wiki/Electromagnetic_Aircraft_Launch_System'],
    migflug: ['MigFlug: how carriers launch jets (steam’s push is front-loaded; about 310 ft of track)', 'https://migflug.com/afterburner/?p=190932'],
    boeing: ['Boeing: F/A-18 Super Hornet (maximum take-off weight 66,000 lb)', 'https://www.boeing.com/defense/fighters-and-bombers/fa-18-super-hornet-and-ea-18-growler'],
    aeroweb: ['Aerospaceweb: F/A-18E/F data (wing 500 ft², 44,000 lb of thrust)', 'https://aerospaceweb.org/aircraft/fighter/f18ef'],
    f35: ['Lockheed Martin: F-35 fast facts (F-35C wing 668 ft², 40,000 lb thrust)', 'https://www.lockheedmartin.com/content/dam/lockheed-martin/aero/documents/F-35/FastFacts%20_June_2020.pdf'],
    t45: ['NAVAIR: T-45 Goshawk (5,527 lb of thrust)', 'https://www.navair.navy.mil/product/T-45-Goshawk-0'],
    t45b: ['Chief of Naval Air Training: T-45C (empty 9,394 lb, maximum 13,500 lb)', 'https://www.cnatra.navy.mil/tw6/vt86/aircraft-T45C.asp'],
    t45c: ['MigFlug: T-45 Goshawk specifications (wing area 17.66 m²)', 'https://migflug.com/aircraft/t-45-goshawk/'],
    gsfc: ['NASA Goddard: Earth’s main field, about 30,000 nT at the equator, 60,000 nT at the poles', 'https://core2.gsfc.nasa.gov/research/mag_field/conrad/explain.html'],
    uw: ['University of Washington: Earth’s magnetic field as a dipole of 8 × 10²² A·m²', 'https://courses.washington.edu/ess502/Lect2_EarthMagneticField.pdf'],
    ams: ['AMS Glossary of Meteorology: the auroral oval (about 67° magnetic latitude at midnight)', 'https://glossarytest.ametsoc.net/wiki/Auroral_oval'],
    hb: ['Handbook of Geophysics (1985), ch. 12: auroral electrons and the heights they reach', 'https://www.ngdc.noaa.gov/stp/space-weather/online-publications/miscellaneous/afrl_publications/handbook_1985/Chptr12.pdf'],
    cluster: ['Physical Review Letters (2011): the auroral acceleration region, 4,000 to 12,000 km up', 'https://link.aps.org/accepted/10.1103/PhysRevLett.106.055002'],
    arase: ['Scientific Reports (2021): arc electrons accelerated to several keV, light at about 100 km', 'https://doi.org/10.1038/s41598-020-79665-5'],
    noaa: ['NOAA Space Weather Prediction Center: aurora tutorial', 'https://www.swpc.noaa.gov/content/aurora-tutorial'],
    wauro: ['Wikipedia: Aurora (pitch angle, colours and heights)', 'https://en.wikipedia.org/wiki/Aurora'],
    atopt: ['Atmospheric Optics: glowing gases (green oxygen 100–150 km, red above)', 'https://www.atoptics.co.uk/blog/glowing-gases-aurorae/'],
    sw: ['NOAA Space Weather Prediction Center: the solar wind (usually about 400 km/s near Earth; 500–800 km/s from coronal holes)', 'https://www.swpc.noaa.gov/phenomena/solar-wind'],
    msfc: ['NASA Marshall: the solar wind (about 400 km/s; 300 km/s over streamers, 800 km/s over coronal holes)', 'https://solarscience.msfc.nasa.gov/SolarWind.shtml'],
    brit: ['Britannica: interplanetary medium (about 5 particles per cm³ at Earth’s orbit)', 'https://www.britannica.com/science/interplanetary-medium'],
    shue: ['Shue et al. (1998) magnetopause model, as set out in: Examining the location of the magnetopause in an undergraduate lab (arXiv:0706.1985)', 'https://arxiv.org/pdf/0706.1985'],
    jel: ['Jelínek et al. (2012) bow shock model r = 15.02·Dp^(−1/6.55), as used in arXiv:1709.01407', 'https://arxiv.org/pdf/1709.01407'],
    fair: ['Fairfield (1971), NASA: average magnetopause 11.0 RE and bow shock 14.6 RE towards the Sun', 'https://ntrs.nasa.gov/api/citations/19710007034/downloads/19710007034.pdf'],
    mpwiki: ['Wikipedia: Magnetopause (most of the wind is deflected round it; reconnection, Dungey 1961)', 'https://en.wikipedia.org/wiki/Magnetopause'],
    newell: ['Newell et al. (2008): Kp from the solar wind, as given in arXiv:1701.06525', 'https://arxiv.org/pdf/1701.06525'],
    kptab: ['SpaceWeatherLive, from NOAA SWPC: Kp and the edge of the auroral oval at local midnight (66° … 48°)', 'https://spaceweatherlive.com/en/help/the-kp-index.html'],
    swpctips: ['NOAA SWPC: tips on viewing the aurora (about 67° magnetic latitude near midnight when quiet)', 'https://www.swpc.noaa.gov/content/tips-viewing-aurora-old'],
    aka: ['Akasofu’s ε = 10⁷·v·B²·l₀²·sin⁴(θ/2) W, l₀ ≈ 7 RE (Perreault and Akasofu 1978), as used in arXiv:2007.12352', 'https://arxiv.org/pdf/2007.12352'],
    may24: ['Wikipedia: May 2024 solar storms (Kp 9, Bz down to −50 nT, 750–800 km/s)', 'https://en.wikipedia.org/wiki/May_2024_solar_storms'],
    mp2025: ['EGUsphere (2024): solar-wind pressure can push the magnetopause inside geosynchronous orbit (6.6 RE)', 'https://egusphere.copernicus.org/preprints/2024/egusphere-2024-1113/egusphere-2024-1113-ATC1.pdf'],
    cusp: ['Frey, Angelopoulos and Mende (2016): the cusp aurora is direct precipitation from the magnetosheath (red 630 nm)', 'https://escholarship.org/uc/item/9qs6d3vf'],
    cusplat: ['NIPR: cusp particles between 77° and 78° magnetic latitude near noon', 'https://nipr.repo.nii.ac.jp/record/4168/files/KJ00000036099.pdf'],
    hess: ['Hess et al. (2001), Radiochimica Acta 89, 357: the ¹⁸O(p,n)¹⁸F reaction from threshold up to 30 MeV, with thick-target yields', 'https://core.ac.uk/download/34905665.pdf'],
    exfor: ['IAEA EXFOR entry D4095: the measured data of Hess et al. (2001)', 'https://www-nds.iaea.org/nrdc/exfor-master/entry/d/d4095.txt'],
    nndc: ['NNDC, Brookhaven: adopted levels of fluorine-18 (half-life 109.77 min)', 'https://www.nndc.bnl.gov/ensnds/18/F/adopted.pdf', 'NNDC'],
    ame: ['KAERI table of nuclides: fluorine-18 (mass excess 0.873 MeV, from the atomic mass evaluation)', 'https://atom.kaeri.re.kr/cgi-bin/nuclide?nuc=F-18'],
    uny: ['Silakhuddin (2016), Jurnal Penelitian Saintek (UNY): the fluorine-18 yield of DECY-13, checked against the Dharmais and MRCCC cyclotrons in Jakarta', 'https://journal.uny.ac.id/index.php/saintek/article/view/10555'],
    dharm: ['Kambali et al.: fluorine-18 from the 11 MeV Eclipse cyclotron at Dharmais Cancer Hospital, Jakarta', 'https://core.ac.uk/download/194633535.pdf'],
    umich: ['University of Michigan (2018), EJNMMI Radiopharmacy and Chemistry: a GE PETtrace at 16 MeV, 55 µA for 22 min, gave 1330 ± 153 mCi; FDG came out at 72 % without decay correction', 'https://link.springer.com/10.1186/s41181-018-0048-x'],
    ibat: ['IBA at Cyclotrons 2013: Nirta Conical water targets at 18 MeV give 8.3–8.7 GBq per µA at saturation', 'https://accelconf.web.cern.ch/CYCLOTRONS2013/posters/wepsh043_poster.pdf'],
    fastlab: ['Journal of Nuclear Medicine Technology 41(1):32: FDG on a FASTlab takes about 22–25 minutes', 'https://tech.snmjournals.org/content/41/1/32.abstract'],
    snmmi: ['SNMMI/EANM guideline (2021), table 4: an adult FDG PET/CT uses about 259–370 MBq (7–10 mCi)', 'https://jnm.snmjournals.org/content/62/1/99/tab-figures-data'],
    eanm: ['EANM procedure guidelines for FDG PET/CT tumour imaging, version 2.0 (2015)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4315529/'],
    kemkes: ['Kemenkes RI (November 2024): cyclotrons for PET in Jakarta hospitals', 'https://kemkes.go.id/id/menkes-dorong-rumah-sakit-swasta-tingkatkan-layanan-dengan-teknologi-canggih-untuk-deteksi-kanker'],
    // why each machine exists, and who it helps
    kemkesfw: ['Kemenkes RI: cancer prevention and control framework (cancer is the third leading cause of death in Indonesia; 408,661 new cases and 242,099 deaths in 2022, GLOBOCAN)', 'https://www.kemkes.go.id/eng/layanan/cancer-prevention-and-control-framework', 'Kemenkes'],
    ugm: ['UGM: cancer cases surge in Indonesia; the high death rate is largely due to late diagnosis and treatment', 'https://ugm.ac.id/en/news/cancer-cases-surge-in-indonesia-experts-stress-early-symptom-awareness', 'UGM'],
    acs: ['American Cancer Society: PET scan for cancer (cancer cells take up more of the FDG sugar; PET helps find cancer, stage it and check treatment)', 'https://www.cancer.org/cancer/diagnosis-staging/tests/imaging-tests/pet-scan-for-cancer.html', 'American Cancer Society'],
    pudong: ['Pudong government: getting to the airport (about 30 km from downtown, an hour’s drive from People’s Square)', 'https://english.pudong.gov.cn/2017-07/19/c_84852_2.htm', 'Pudong government'],
    navair: ['NAVAIR: EMALS (launches everything from light unmanned aircraft to heavy fighters, less stress on ship and aircraft; quieter, cooler spaces for sailors)', 'https://www.navair.navy.mil/product/Electromagnetic-Aircraft-Launch-System-EMALS', 'NAVAIR'],
    emalsw: ['Wikipedia: Electromagnetic Aircraft Launch System (smoother push, less stress on airframes; steam cannot launch aircraft as light as many drones)', 'https://en.wikipedia.org/wiki/Electromagnetic_Aircraft_Launch_System', 'Wikipedia'],
    q1989: ['NOAA NESDIS: when solar storms attack (13 March 1989: six million people in Quebec without power for nine hours)', 'https://www.nesdis.noaa.gov/news/when-solar-storms-attack-space-weather-and-our-infrastructure', 'NOAA'],
    starlink: ['NOAA National Weather Service: a minor geomagnetic storm in February 2022 destroyed 38 of 49 new Starlink satellites', 'https://www.weather.gov/news/111522-starlink', 'NOAA'],
    dscovr: ['NOAA NESDIS: DSCOVR at L1, about 1.5 million km from Earth; a monitor there gives 15 to 60 minutes of warning before a storm (CME) reaches Earth', 'https://www.nesdis.noaa.gov/our-satellites/currently-flying/dscovr-deep-space-climate-observatory', 'NOAA'],
    pve: ['Soret, Bacharach & Buvat, J Nucl Med 48 (2007) 932: the partial-volume effect. Tumours smaller than about 3 times the resolution (FWHM) look dimmer than they are, and the smaller the tumour, the bigger the underestimate', 'https://jnm.snmjournals.org/content/48/6/932', 'J Nucl Med'],
    ctac: ['Kinahan, Townsend, Beyer & Sashin, Med Phys 25 (1998) 2046: attenuation correction of PET from the CT of a combined PET/CT scanner', 'https://doi.org/10.1118/1.598392', 'Med Phys'],
    kak: ['Kak & Slaney, Principles of Computerized Tomographic Imaging (IEEE Press 1988), ch. 3: filtered back-projection and the sampled ramp filter', 'https://engineering.purdue.edu/~malcolm/pct/pct-toc.html', 'Kak & Slaney'],
    moses: ['Moses, Nucl Instrum Meth A 648 (2011) S236: fundamental limits of PET resolution, Γ = 1.25 √((d/2)² + s² + (0.0044R)² + b²); positron-range blur 0.54 mm for ¹⁸F', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3144741', 'Moses 2011'],
    vision: ['van Sluis et al., J Nucl Med 60 (2019) 1031: the Biograph Vision PET/CT (3.2 mm LSO crystals, 78 cm bore, 3.6 mm resolution, time of flight 210–215 ps)', 'https://jnm.snmjournals.org/node/47342', 'J Nucl Med'],
    posrange: ['J Nucl Med (2021), table 1: positron emitters (β⁺ fraction, maximum energy, mean range in water: ¹⁸F 0.66 mm, ⁶⁸Ga 3.56 mm, ⁸²Rb 7.49 mm)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8262615/table/T1', 'J Nucl Med'],
    mu511: ['Burger et al., Eur J Nucl Med (2002): μ = 0.096 /cm for water at 511 keV; only about 5 % of photons from the centre of the body are detected', 'https://core.ac.uk/download/159147467.pdf', 'Burger et al.'],
    aapm: ['AAPM 2004: attenuation correction factors through water, about 7 for 20 cm and 50 for 40 cm', 'https://www.aapm.org/meetings/04am/pdf/14-2324-1515.pdf', 'AAPM'],
    cernam: ['CERN: everyday antimatter (antimatter is used every day in medicine, in PET scans)', 'https://livefromcern-archive.web.cern.ch/antimatter/everyday/AM-everyday00.html', 'CERN'],
    cernam2: ['CERN: PET scan (electron and positron are almost at rest when they annihilate; a brain “in action” while the person sees words)', 'https://livefromcern-archive.web.cern.ch/antimatter/everyday/AM-everyday01.html', 'CERN'],
    cernmed: ['CERN, medical applications of particle physics (Degiovanni 2016): PET and collider detectors share the same challenges, crystals and fast photodetectors', 'https://indico.cern.ch/event/472020/contributions/2289734/attachments/1365475/2068338/Medical_applications_Degiovanni_03_11_2016.pdf', 'CERN'],
    nopr: ['Hillner et al., J Clin Oncol 2008 (National Oncologic PET Registry): 22,975 scans; management changed in 36.5 %; biopsy avoided in about 70 % of planned cases', 'https://profiles.wustl.edu/en/publications/impact-of-positron-emission-tomographycomputed-tomography-and-pos/', 'J Clin Oncol'],
    utah: ['University of Utah, electron microscopy tutorial: λ = 3.70, 2.51 and 1.96 pm at 100, 200 and 300 keV; light microscopes about 200 nm', 'https://advanced-microscopy.utah.edu/education/electron-micro/', 'Utah'],
    tem672: ['Duscher, Introduction to TEM: magnetic lenses (fields of 1 T or more, iron pole pieces up to about 2.1 T)', 'https://gduscher.github.io/MSE672-Introduction-to-TEM/Instrument/CH5_03-Lenses.html', 'Duscher'],
    tem672e: ['Duscher, Introduction to TEM: the electron (200 keV: λ = 2.51 pm, v = 0.6953 c, m/m₀ = 1.3914)', 'https://gduscher.github.io/MSE672-Introduction-to-TEM/Diffraction/CH2_01-Electron.html', 'Duscher'],
    epflcs: ['EPFL CIME, Cs-TEM vs Cs-STEM: 200 kV Talos (Cs 1.2 mm) point resolution 2.4 Å; 300 kV, 2.0 Å', 'https://www.epfl.ch/research/facilities/cime/wp-content/uploads/2019/02/Chapter-5-Cs-TEM-vs-Cs-STEM.pdf', 'EPFL'],
    ruska: ['Nobel Prize in Physics 1986, press release: Ruska found that a magnetic coil acts as a lens for electrons; in 1933 his electron microscope beat the light microscope', 'https://www.nobelprize.org/nobel_prizes/physics/laureates/1986/press.html', 'Nobel Prize'],
    zhu: ['Chinese Academy of Sciences on Zhu et al., NEJM 2020: the new coronavirus in the electron microscope, 60–140 nm across, spikes 9–12 nm', 'https://english.cas.cn/newsroom/cas_media/202001/t20200131_229807.shtml', 'CAS'],
    ecoli: ['Britannica: E. coli is about 2 µm long and 0.5 µm in diameter', 'https://www.britannica.com/science/bacteria/Diversity-of-structure-of-bacteria', 'Britannica'],
    flag: ['BioNumbers: bacterial flagella, about 20 nm thick, 5–10 µm long, helical pitch 2–2.5 µm', 'https://bionumbers.hms.harvard.edu/bionumber.aspx?id=100095', 'BioNumbers'],
    rbc: ['BioNumbers: a red blood cell is a disc about 8 µm across and 2 µm thick', 'https://bionumbers.hms.harvard.edu/bionumber.aspx?id=100798', 'BioNumbers'],
    wrapp: ['Wrapp et al., Science 2020: cryo-EM structure of the 2019-nCoV spike at 3.5 Å; the spike is a key target for vaccines', 'https://pubmed.ncbi.nlm.nih.gov/32075877/', 'Science'],
    almeida: ['National Geographic: June Almeida saw the first coronavirus in her electron microscope in 1964; its halo of spikes gave the name', 'https://www.nationalgeographic.com/history/article/june-almeida-discovered-coronaviruses-decades-ago-little-recognition', 'National Geographic'],
    emvir: ['Goldsmith & Miller, Clin Microbiol Rev 2009: electron microscopy is still used to diagnose viral infections and needs no organism-specific reagents', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2772359/', 'Clin Microbiol Rev'],
    kidney: ['Electron microscopy in renal biopsies (review): without it, some cases are diagnosed incorrectly', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9677721/', 'review'],
    cdsem: ['Applied Materials: the CD-SEM, “the ruler of the fab”, measures chip patterns to below a nanometre', 'https://www.appliedmaterials.com/us/en/product-library/veritysem-20-cd-metrology.html', 'Applied Materials'],
    solar1: ['NOAA OSPO: SOLAR-1 (launched as SWFO-L1 in September 2025) at L1, 1.5 million km out, NOAA’s primary solar-wind monitor since 10 June 2026', 'https://ospo.noaa.gov/operations/swfo/status.html', 'NOAA'],
    gscale: ['NOAA Space Weather Scales: geomagnetic storms G1 (Kp 5) to G5 (Kp 9) and their effects', 'https://www.swpc.noaa.gov/noaa-scales-explanation', 'NOAA'],
    maven: ['NASA: MAVEN reveals the speed of solar wind stripping the Martian atmosphere (about 100 g every second)', 'https://www.nasa.gov/news-release/nasa-mission-reveals-speed-of-solar-wind-stripping-martian-atmosphere', 'NASA'],
    venus: ['Venus Express results (Zhang et al. 2007), as summarised in arXiv:0806.1825: with no field of its own, Venus holds the wind off only about 300 km up; bow shock about 1,900 km up', 'https://arxiv.org/pdf/0806.1825', 'Venus Express'],
    britv: ['Britannica: Venus and the solar wind (Earth’s bow shock about 65,000 km out; Venus’s only a few thousand km)', 'https://www.britannica.com/place/Venus-planet/Interaction-with-the-solar-wind', 'Britannica'],
    cernweb: ['CERN: a short history of the Web (invented at CERN in 1989 so scientists could share information)', 'https://home.cern/science/computing/birth-web/short-history-web', 'CERN'],
    therapy: ['CERN: collaborations open new horizons for cancer therapy (PIMMS led to CNAO and MedAustron; particle beams have helped cure more than 260,000 patients)', 'https://www.home.cern/news/news/knowledge-sharing/cern-collaborations-open-new-horizons-cancer-therapy', 'CERN'],
    medipix: ['CERN Courier (2018): first 3D colour X-ray of a human, with Medipix3 chips, a family first developed for particle tracking at the LHC', 'https://cerncourier.com/a/first-human-3d-x-ray-in-colour/', 'CERN Courier'],
    mri: ['Fermilab: IEEE Milestone for the Tevatron’s superconducting magnets, which set up the wire industry that made MRI viable', 'https://news.fnal.gov/?p=117749', 'Fermilab'],
    cmsmass: ['CMS, CERN: why the Higgs boson matters (with massless electrons, atoms could not form)', 'https://cms.cern/node/1380', 'CMS'],
    cernhf: ['CERN fact sheet: CERN and the Higgs boson (most of the mass of matter comes from the strong force inside protons and neutrons)', 'https://www.home.cern/sites/default/files/2018-06/factsheet-_cern_and_the_higgs_boson.pdf', 'CERN'],
    cernfacts: ['CERN: the Large Hadron Collider, facts and figures (6.8 TeV, 11,245 turns a second, 1.5 billion collisions a second, 8 cavities of 2 MV)', 'https://home.cern/resources/faqs/facts-and-fi'],
    lhcdr: ['LHC Design Report, vol. 1 ch. 2 (bending radius 2803.95 m; 0.535 T at injection, 8.33 T at 7 TeV)', 'https://indico.cern.ch/event/1001431/contributions/4205544/attachments/2183624/3689221/Vol_1_Chapter_2.pdf'],
    lhcmo: ['LHC Machine Outreach: vital statistics (450 GeV injection, 8.33 T, 400.8 MHz, 11.2455 kHz)', 'https://lhc-machine-outreach.web.cern.ch/lhc-vital-statistics.htm'],
    cernfaq: ['CERN: LHC the guide (0.999997828 c at 450 GeV, 0.999999991 c at 7 TeV)', 'https://home.cern/sites/default/files/2018-07/CERN-Brochure-2017-002-Eng.pdf'],
    bruning: ['Brüning, Burkhardt and Myers: The Large Hadron Collider (p = Bρ, ρ = 2804 m)', 'https://indico.cern.ch/event/184080/contributions/1455617/attachments/252027/352392/The-Large-Hadron-Collider_Bruening-Burkhardt-Myers.pdf'],
    higgs: ['CERN poster: the Higgs boson is made in about one collision in a billion', 'http://cds.cern.ch/record/2696176'],
    dipole: ['IEEE Trans. Appl. Supercond. (2007): LHC dipoles, 8.33 T nominal, up to 9 T “ultimate”', 'https://air.unimi.it/retrieve/handle/2434/664376/1290328/04277281.pdf'],
    cernhours: ['CERN: the LHC (about 2,500 bunches of 1.6 × 10¹¹ protons; beams collide for 10 to 15 hours)', 'https://home.cern/resources/faqs/higgs-boson'],
    synch: ['Beam dynamics in synchrotrons, LHC table from the Design Report (16 MV per beam, 485 keV gained per turn)', 'https://arxiv.org/pdf/1804.08873'],
    losses: ['Beam dynamics and beam losses, circular machines (LHC ramp over 15 minutes, about 500 keV per turn)', 'https://arxiv.org/pdf/1608.02449'],
    juas: ['JUAS 2013 exam, longitudinal dynamics: the LHC ramp from 450 to 7000 GeV/c in 20 minutes', 'https://emetral.web.cern.ch/JUAS/2013/LongitudinalDynamicsExamination_JUAS2013_EM.pdf'],
  };

  /* ---------------- the three simulations and where they live ---------------- */
  const SIM = {
    maglev: { name: 'Maglev train', tag: 'the airport in 8 minutes', art: 'maglev', host: 'gauss', line: 'The Shanghai airport train: 30 km in about 8 minutes.', why: 'Crosses 30 km to the airport in about 8 minutes, pulled by coils in the track: a Gauss gun as a railway.' },
    catapult: { name: 'Jet catapult', tag: 'a runway at sea', art: 'emals', host: 'gauss', line: 'Throw a fighter jet off an aircraft carrier.', why: 'Gives a jet the runway a ship does not have: coils in the deck throw it to flying speed in under 3 seconds.' },
    pet: { name: 'PET medicine', tag: 'finds cancer early', art: 'pet', host: 'lab', line: 'Make the medicine that finds cancer, before it decays.', why: 'Makes the medicine that finds cancer, fresh every morning, because it halves every 110 minutes.' },
    aurora: { name: 'Aurora', tag: 'Earth’s shield', art: 'aurora', host: 'lab', line: 'Follow an electron down to the polar sky.', why: 'Shows Earth’s magnetic shield at work: it bends the solar wind away with your cyclotron’s force.' },
    petscan: { name: 'PET scanner', tag: 'antimatter finds cancer', art: 'petscan', host: 'collide', line: 'Watch antimatter meet matter inside a patient.', why: 'Puts antimatter in a patient on purpose: each positron meets an electron, and the two gamma rays that fly apart show where a cancer is.' },
    tem: { name: 'Electron microscope', tag: 'sees a virus', art: 'tem', host: 'lab', line: 'Focus electrons with a magnet to see a virus.', why: 'Bends electrons with a magnetic lens, the aurora’s spiral inside a coil, to see what light never can: a virus and its spikes.' },
    lhc: { name: 'LHC', tag: 'what matter is made of', art: 'lhc', host: 'collide', line: 'Run the 27 km Large Hadron Collider at CERN.', why: 'Found the Higgs boson, the sign of the field that gives electrons their mass. Its home, CERN, also gave us the Web and new cancer therapy.' },
  };
  const ORDER = ['maglev', 'catapult', 'pet', 'petscan', 'aurora', 'tem', 'lhc'];
  const HOSTS = { lab: ['pet', 'aurora', 'tem', 'lhc'], gauss: ['maglev', 'catapult'], collide: ['lhc', 'petscan'] };
  const HOST_NAME = { lab: 'cyclotron', gauss: 'Gauss gun', collide: 'Collider' };
  const ICON = {
    maglev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 14.5h15.8c2.9 0 5.2-1.2 5.2-2.9 0-2.1-3.2-4.6-8.5-4.6H1.5zm2-5.6h3v2.4h-3zm4.5 0h3v2.4H8zm4.5 0h2.4c1 0 2.1.5 2.8 1.3l.9 1.1h-6.1zM1.5 16.5h21v1.8h-21z"/></svg>',
    catapult: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12.6 8.6 12l2.9-6.4h2.2l-1.5 6.2 4.9-.4L19.6 8h1.6l-.9 3.8 1.7.4v1.6l-1.7.4.9 3.8h-1.6l-2.5-3.4-4.9-.4 1.5 6.2h-2.2L8.6 14 2 13.4z"/></svg>',
    pet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M10 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 3.6a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8z"/><path d="M3 12.2h20v1.9H3z"/><circle cx="10" cy="10.3" r="1.4"/></svg>',
    aurora: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM3.6 10.4C4.9 5.6 8.1 2.5 12 2.5s7.1 3.1 8.4 7.9l-1.9.6C17.5 7 15 4.5 12 4.5S6.5 7 5.5 11z"/></svg>',
    petscan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12 2.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 0 1 0-18.4zm0 2.3a6.9 6.9 0 1 0 0 13.8 6.9 6.9 0 0 0 0-13.8z"/><path d="m5.6 16.9 12-9.3 1 1.2-12 9.3z"/><circle cx="12" cy="12" r="1.7"/></svg>',
    tem: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 1.8h5.6v2.8H9.2zM8 4.6h8v4H8zM10 8.6h4v2.6h-4zM6.4 11.2h11.2v3H6.4zM10 14.2h4v2.2h-4zM5 16.4h14v2.6H5zM3 20.2h18v1.8H3z"/></svg>',
    lhc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/><circle cx="12" cy="4" r="2.2"/><circle cx="12" cy="20" r="2.2"/><path d="M10.5 12h3M12 10.5v3" stroke="currentColor" stroke-width="1.6"/></svg>',
  };

  /* ---------------- small builders for the side panel ---------------- */
  const ctl = (id, label, unit, mode = 'decimal') => `<div class="ctl"><div class="ctl-row"><label class="ctl-label" for="r-rs-${id}">${label}</label><div class="ctl-num"><input id="n-rs-${id}" type="number" inputmode="${mode}" aria-label="${label}${unit ? ' in ' + unit : ''}"><span class="ctl-unit">${unit}</span></div></div><input id="r-rs-${id}" type="range"></div>`;
  const range = (id, o) => bindRange(Object.assign({ range: $('#r-rs-' + id), num: $('#n-rs-' + id) }, o));
  const segHTML = (id, label, opts, cls = '') => `<div class="seg ${cls}" id="rs-${id}" role="radiogroup" aria-label="${label}">${opts.map(([v, t, s]) => `<button type="button" role="radio" data-value="${v}">${t}${s ? `<small>${s}</small>` : ''}</button>`).join('')}</div>`;
  const row = (label, val, sub, work, cls = '') => `<div class="drow${cls ? ' is-' + cls : ''}"><div class="drow-head"><span class="drow-label">${label}</span><span class="drow-val">${val}</span></div>${sub ? `<div class="drow-sub">${sub}</div>` : ''}${work ? `<div class="drow-work">${work}</div>` : ''}</div>`;
  const sec = t => `<div class="dsec">${t}</div>`;
  const cmpTable = rows => `<div class="table-wrap"><table class="nb-table rs-cmp"><thead><tr><th>What</th><th>This simulation</th><th>Real world</th><th>Source</th></tr></thead><tbody>${rows.map(([w, m, r, s, cls]) => `<tr${cls ? ` class="is-${cls}"` : ''}><td>${w}</td><td>${m}</td><td>${r}</td><td>${s ? `<a href="${SRC[s][1]}" target="_blank" rel="noopener">${esc(SRC[s][0].split(':')[0])}</a>` : '–'}</td></tr>`).join('')}</tbody></table></div>`;

  /* ---------------- the stations' own numbers, for the side-by-side comparisons ---------------- */
  let gaussCache = { key: '' };
  function gaussNow() {                       // the student's coil gun as it is set now (fired in the background, not on screen)
    const g = CL.screens.gauss && CL.screens.gauss.S;
    if (!g) return null;
    const key = [g.stages, g.turns, g.current, g.slugCm, g.material, g.cutoff].join();
    if (gaussCache.key !== key) {
      try { const r = CL.PHYS.coilgun({ stages: g.stages, turns: g.turns, current: g.current, slugLen: g.slugCm / 100, material: g.material, cutoff: g.cutoff, real: false }); gaussCache = { key, r, g: Object.assign({}, g) }; }
      catch (err) { return null; }
    }
    return gaussCache;
  }
  function labNow() {                         // the student's cyclotron as it is set now
    if (!CL.lab || !CL.lab.D) return null;
    const D = CL.lab.D, P = CL.lab.pred, S = CL.lab.S;
    return { B: D.Bmag, part: D.part, fc: P.fc, Kmax: P.Kmax, vmax: P.vmax, R: S.R, V: S.Vkv * 1e3, gain: P.gainTurn, coils: S.coils, turns: S.turns, I: D.I };
  }
  const fmtLenS = m => m >= 1000 ? `${pl(m / 1000, 3)} km` : m >= 1 ? `${pl(m, 3)} m` : m >= 0.01 ? `${pl(m * 100, 3)} cm` : `${pl(m * 1000, 3)} mm`;
  const fmtB = B => B >= 0.1 ? `${pl(B, 3)} T` : B >= 1e-4 ? `${pl(B * 1e3, 3)} mT` : B >= 1e-6 ? `${pl(B * 1e6, 3)} μT` : `${pl(B * 1e9, 3)} nT`;

  /* ---------------- backgrounds shared by the 2D and 3D views ---------------- */
  // sunset over the sea: horizon at y = hy; shift moves the clouds a little as the camera moves
  function drawSunset(c, W, H, hy, tt, shift = 0, sunX = null) {
    const top = Math.min(0, hy - H);
    const sg = c.createLinearGradient(0, top, 0, hy);
    sg.addColorStop(0, '#141c3a'); sg.addColorStop(0.45, '#3d2e5c'); sg.addColorStop(0.72, '#a2506a'); sg.addColorStop(0.9, '#ec8a5a'); sg.addColorStop(1, '#ffc27a');
    c.fillStyle = sg; c.fillRect(0, 0, W, Math.max(0, hy));
    const sx = sunX == null ? W * 0.74 : sunX, sr = Math.max(18, Math.min(W, H) * 0.07);
    glow(c, sx, hy, Math.min(W, H) * 0.75, '255,150,80', 0.35);
    glow(c, sx, hy, sr * 3, '255,210,140', 0.6);
    c.save(); c.beginPath(); c.rect(0, 0, W, hy); c.clip();
    const sd = c.createRadialGradient(sx, hy - sr * 0.2, 0, sx, hy - sr * 0.2, sr); sd.addColorStop(0, '#fff4d6'); sd.addColorStop(0.7, '#ffd08a'); sd.addColorStop(1, '#ffb066');
    c.fillStyle = sd; c.beginPath(); c.arc(sx, hy + sr * 0.35, sr, 0, TAU); c.fill();
    // long thin clouds, lit pink-orange from below
    for (let i = 0; i < 7; i++) {
      const cy = hy - (0.12 + 0.5 * hash(i + 40)) * Math.max(80, hy), cw = W * (0.18 + 0.3 * hash(i + 7)), cx = ((hash(i) * 1.6 - 0.3) * W - shift * 0.02 * (1 + i * 0.1)) % (W * 1.4);
      const x = cx < -cw ? cx + W * 1.4 : cx, lit = 1 - (hy - cy) / Math.max(80, hy);
      const cg = c.createLinearGradient(0, cy - 6, 0, cy + 6); cg.addColorStop(0, `rgba(110,70,110,${0.35 + 0.2 * lit})`); cg.addColorStop(1, `rgba(255,${150 + 60 * lit},${110 + 40 * lit},${0.45 + 0.3 * lit})`);
      c.fillStyle = cg; c.beginPath(); c.ellipse(x, cy, cw / 2, 3 + 5 * hash(i + 3), 0, 0, TAU); c.fill();
    }
    c.restore();
    // the sea
    if (hy < H) {
      const wg = c.createLinearGradient(0, hy, 0, H); wg.addColorStop(0, '#5a4060'); wg.addColorStop(0.12, '#2c2f4e'); wg.addColorStop(1, '#0a1020');
      c.fillStyle = wg; c.fillRect(0, hy, W, H - hy);
      // the sun's glitter path
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 60; i++) {
        const f = hash(i + 200), y = hy + 2 + Math.pow(f, 1.6) * (H - hy), spread = 6 + (y - hy) * 0.35, x = sx + (hash(i + 300) - 0.5) * 2 * spread + Math.sin(tt * 2 + i) * 3;
        const a = (0.55 - 0.45 * f) * (0.5 + 0.5 * Math.sin(tt * 3.1 + i * 1.7));
        c.fillStyle = `rgba(255,190,120,${Math.max(0, a)})`; c.fillRect(x - (4 + 8 * (1 - f)), y, 8 + 16 * (1 - f), 1.4);
      }
      c.restore();
      c.strokeStyle = 'rgba(255,170,130,0.12)'; c.lineWidth = 1;
      for (let i = 0; i < 9; i++) { const y = hy + 6 + i * i * 2.4; if (y > H) break; c.beginPath(); for (let x = 0; x <= W; x += 12) { const yy = y + Math.sin(x * 0.03 + i + tt * (0.6 + i * 0.05) + shift * 0.03) * (1 + i * 0.3); x ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke(); }
    }
  }
  // blue hour over a city: the sky down to the horizon at hy, a low moon, a warm afterglow; the land below it
  function drawBlueHour(c, W, H, hy, tt) {
    const top = Math.min(0, hy - H * 1.1);
    const sg = c.createLinearGradient(0, top, 0, hy);
    sg.addColorStop(0, '#0a1430'); sg.addColorStop(0.45, '#1d2d5c'); sg.addColorStop(0.75, '#5a4778'); sg.addColorStop(0.92, '#c46e6a'); sg.addColorStop(1, '#f0a070');
    c.fillStyle = sg; c.fillRect(0, 0, W, Math.max(0, hy));
    for (let i = 0; i < 60; i++) { const x = hash(i) * W, y = top + hash(i + 50) * (hy - top) * 0.5; if (y < 0 || y > hy) continue; c.fillStyle = `rgba(230,240,255,${(0.15 + 0.4 * hash(i + 9)) * (1 - (y - top) / Math.max(1, (hy - top) * 0.5))})`; c.fillRect(x, y, 1.3, 1.3); }
    glow(c, W * 0.82, hy, Math.max(W, H) * 0.55, '255,160,100', 0.25);
    const mx = W * 0.18, my = top + (hy - top) * 0.3, mr = Math.max(9, H * 0.026);
    if (my > -mr && my < hy) { glow(c, mx, my, mr * 5, '220,230,255', 0.12); c.fillStyle = '#f3f0e2'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.fillStyle = 'rgba(29,45,92,0.92)'; c.beginPath(); c.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.92, 0, TAU); c.fill(); }
    if (hy < H) { const gg = c.createLinearGradient(0, hy, 0, H); gg.addColorStop(0, '#2a2a3a'); gg.addColorStop(0.08, '#1b2224'); gg.addColorStop(1, '#0c1110'); c.fillStyle = gg; c.fillRect(0, Math.max(0, hy), W, H - Math.max(0, hy)); }
  }
  // a starry sky with the Milky Way: stars are fixed to the screen size (seeded), and twinkle a little
  let starCache = null;
  function drawStars(c, W, H, tt, n = 260) {
    if (!starCache || starCache.W !== W || starCache.H !== H) {
      const cv = document.createElement('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the Milky Way: a soft diagonal band of light and dust
      g.save(); g.translate(W * 0.5, H * 0.5); g.rotate(-0.5);
      const band = g.createLinearGradient(0, -H * 0.28, 0, H * 0.28); band.addColorStop(0, 'rgba(120,130,200,0)'); band.addColorStop(0.5, 'rgba(170,165,215,0.16)'); band.addColorStop(1, 'rgba(120,130,200,0)');
      g.fillStyle = band; g.fillRect(-W, -H * 0.28, 2 * W, H * 0.56);
      for (let i = 0; i < 900; i++) { const x = (hash(i + 1000) - 0.5) * 2 * W, y = (hash(i + 2000) + hash(i + 3000) - 1) * H * 0.22, a = 0.05 + 0.2 * hash(i + 4000); g.fillStyle = `rgba(225,225,255,${a})`; g.fillRect(x, y, 1, 1); }
      g.restore();
      const neb = g.createRadialGradient(W * 0.2, H * 0.25, 0, W * 0.2, H * 0.25, Math.max(W, H) * 0.35); neb.addColorStop(0, 'rgba(110,60,140,0.10)'); neb.addColorStop(1, 'rgba(110,60,140,0)');
      g.fillStyle = neb; g.fillRect(0, 0, W, H);
      const pts = [];
      for (let i = 0; i < n; i++) { const b = hash(i + 7000); pts.push([hash(i + 5000) * W, hash(i + 6000) * H, b, hash(i + 8000)]); }
      starCache = { W, H, cv, pts };
    }
    c.drawImage(starCache.cv, 0, 0, W, H);
    for (const [x, y, b, k] of starCache.pts) {
      const tw = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(tt * (1 + 2 * k) + k * 50), a = (0.25 + 0.75 * b * b) * tw;
      const col = k < 0.15 ? '255,215,170' : k > 0.85 ? '180,205,255' : '235,240,255';
      if (b > 0.93) { glow(c, x, y, 5, col, 0.6 * tw); c.fillStyle = `rgba(${col},1)`; c.fillRect(x - 1, y - 1, 2, 2); }
      else { c.fillStyle = `rgba(${col},${a})`; c.fillRect(x, y, b > 0.7 ? 1.6 : 1, b > 0.7 ? 1.6 : 1); }
    }
  }

  /* ---------------- small looping drawings for the comparison card ---------------- */
  // 3-D skies: stars are directions, so they turn with the camera but never come closer; the Milky Way is a band of faint ones
  const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const v3n = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const v3x = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let skyDirs = null;
  function skyPoint(S, d) { const z = v3dot(d, S.Fw); if (z < 0.02) return null; return [S.cx + S.f * v3dot(d, S.Rw) / z, S.cy - S.f * v3dot(d, S.Uw) / z, z]; }
  function drawSky3d(g, W, H, S, tt, o = {}) {
    if (!skyDirs) {
      skyDirs = [];
      for (let i = 0; i < 760; i++) { const z = 2 * hash(i + 5000) - 1, ph = TAU * hash(i + 6000), r = Math.sqrt(1 - z * z); skyDirs.push([r * Math.cos(ph), r * Math.sin(ph), z, Math.pow(hash(i + 7000), 3), hash(i + 8000)]); }
      const n = v3n([0.35, -0.5, 0.8]), u = v3n(v3x(n, [1, 0, 0])), w = v3x(n, u);
      for (let i = 0; i < 1700; i++) {
        const a = TAU * hash(i + 9000), off = (hash(i + 9100) + hash(i + 9200) + hash(i + 9300) - 1.5) * 0.2 * (1 + 0.6 * Math.sin(3 * a));
        const d = v3n([0, 1, 2].map(k => u[k] * Math.cos(a) + w[k] * Math.sin(a) + n[k] * off));
        skyDirs.push([d[0], d[1], d[2], 0.03 + 0.11 * hash(i + 9400), -1]);
      }
    }
    const top = o.horizon == null ? H : o.horizon;
    for (const st of skyDirs) {
      if (o.up && st[2] < -0.05) continue;
      const q = skyPoint(S, st); if (!q || q[0] < -2 || q[0] > W + 2 || q[1] < -2 || q[1] > top) continue;
      if (st[4] < 0) { g.fillStyle = `rgba(205,205,245,${st[3]})`; g.fillRect(q[0], q[1], 1.2, 1.2); continue; }
      const tw = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(tt * (1 + 2 * st[4]) + st[4] * 50), a = (0.22 + 0.78 * st[3]) * tw * (o.dim || 1), sz = 0.8 + 1.7 * st[3];
      g.fillStyle = st[4] > 0.85 ? `rgba(255,220,190,${a})` : st[4] < 0.12 ? `rgba(190,210,255,${a})` : `rgba(238,242,255,${a})`;
      g.fillRect(q[0] - sz / 2, q[1] - sz / 2, sz, sz);
    }
  }
  // the Earth seen from space: day and night from the real direction of the Sun, a thin bright air on the day side
  function addEarth(sc, SUN, o = {}) {
    const su = [v3dot(SUN, sc.Rw), -v3dot(SUN, sc.Uw)], e = v3dot(SUN, sc.Fw), ang = Math.atan2(su[1], su[0]);
    sc.custom([0, 0, 0], (g, x, y, k) => {
      const r = k;
      g.translate(x, y); g.rotate(ang);
      const ng = g.createRadialGradient(-r * 0.3, 0, r * 0.1, 0, 0, r); ng.addColorStop(0, '#0e1c36'); ng.addColorStop(1, '#04080f');
      g.fillStyle = ng; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
      if (e > 0) g.ellipse(0, 0, Math.max(0.001, r * e), r, 0, Math.PI / 2, -Math.PI / 2, true); else g.ellipse(0, 0, Math.max(0.001, -r * e), r, 0, Math.PI / 2, Math.PI * 1.5, false);
      g.closePath();
      const dg = g.createRadialGradient(r * 0.5, -r * 0.15, r * 0.05, r * 0.2, 0, r * 1.05); dg.addColorStop(0, '#6fb4ec'); dg.addColorStop(0.45, '#2f73b4'); dg.addColorStop(1, '#123a66');
      g.fillStyle = dg; g.fill();
      g.save(); g.clip(); g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
      for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse((hash(i + 20) - 0.3) * r * 1.4, (hash(i + 30) - 0.5) * r * 1.8, r * (0.2 + 0.3 * hash(i + 40)), r * 0.05, (hash(i + 50) - 0.5) * 0.6, 0, TAU); g.fill(); }
      g.restore();
      const ag = g.createRadialGradient(0, 0, r * 0.96, 0, 0, r * 1.1); ag.addColorStop(0, 'rgba(110,180,255,0.55)'); ag.addColorStop(1, 'rgba(110,180,255,0)');
      g.fillStyle = ag; g.beginPath(); g.arc(0, 0, r * 1.1, -Math.PI / 2, Math.PI / 2); g.arc(0, 0, r * 0.96, Math.PI / 2, -Math.PI / 2, true); g.fill();
    }, o);
  }
  const ease = f => f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
  function linkBack(c, W, H) { c.fillStyle = '#070b0d'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1; c.beginPath(); for (let x = 0.5; x < W; x += 22) { c.moveTo(x, 0); c.lineTo(x, H); } for (let y = 0.5; y < H; y += 22) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke(); }
  // two panels side by side, or one above the other on a narrow screen
  function twoPanels(c, W, H, t, left, right) {
    linkBack(c, W, H);
    const stack = W < 520, w = stack ? W : W / 2, h = stack ? H / 2 : H;
    c.save(); left(c, w, h, t); c.restore();
    c.save(); c.translate(stack ? 0 : w, stack ? h : 0); right(c, w, h, t); c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 1; c.beginPath();
    if (stack) { c.moveTo(8, h + 0.5); c.lineTo(W - 8, h + 0.5); } else { c.moveTo(w + 0.5, 8); c.lineTo(w + 0.5, H - 8); }
    c.stroke();
  }
  // the cyclotron's spiral: two dees, a half-circle per crossing, each one a little bigger
  function spiral(c, cx, cy, R, t, T = 4, n = 10) {
    const ph = (t % T) / T * n;
    for (const s of [-1, 1]) { c.fillStyle = s < 0 ? 'rgba(229,72,63,0.16)' : 'rgba(62,126,230,0.16)'; c.beginPath(); c.arc(cx + s * 2, cy, R, s < 0 ? Math.PI / 2 : -Math.PI / 2, s < 0 ? Math.PI * 1.5 : Math.PI / 2); c.fill(); }
    let y = cy, last = null; c.lineWidth = 1.6;
    for (let k = 0; k < Math.min(n, Math.ceil(ph)); k++) {
      const up = k % 2 === 0, r = R * 0.95 * Math.sqrt((k + 1) / n), ccy = up ? y - r : y + r, fr = Math.min(1, ph - k), a0 = up ? Math.PI / 2 : -Math.PI / 2;
      c.strokeStyle = `hsl(${200 - k * 14},90%,62%)`; c.beginPath(); c.arc(cx, ccy, r, a0, a0 - Math.PI * fr, true); c.stroke();
      const a = a0 - Math.PI * fr; last = [cx + r * Math.cos(a), ccy + r * Math.sin(a)];
      y = up ? ccy - r : ccy + r;
    }
    if (last) glow(c, last[0], last[1], 7, '255,255,255', 0.9);
  }
  const perSec = f => f >= 1e6 ? `${pl(f / 1e6, 3)} million times a second` : f >= 1e4 ? `${pl(f / 1e3, 3)} thousand times a second` : `${pl(f, 3)} times a second`;
  function panelCyclo(caption) {
    return (c, w, h, t) => {
      const lab = labNow(), R = Math.min(w * 0.2, h * 0.36);
      spiral(c, w * 0.72, h * 0.56, R, t);
      text(c, 'your cyclotron', 10, 15, { size: 13 });
      text(c, lab ? `B = ${fmtB(lab.B)}` : 'B ≈ 1 T', 10, 33, { size: 12, color: '#9df5b8' });
      text(c, lab ? `circles ${perSec(lab.fc)}` : 'circles millions of times a second', 10, 50, { size: 12, color: '#9df5b8' });
      text(c, caption, 10, h - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
    };
  }
  // your cyclotron (B fixed, the circle grows with each push) next to an electron spiralling down one of Earth's field lines
  function drawLinkCyclo(c, W, H, t, o) {
    twoPanels(c, W, H, t, panelCyclo('the dees push it: the circle grows'), (c, w, h, t) => {
      const ex = w * 0.5, ey = h * 0.6, er = Math.min(w * 0.08, h * 0.15), Lp = Math.min(w * 0.42, h * 0.95);
      const pt = la => { const r = Lp * Math.cos(la) ** 2; return [ex + r * Math.cos(la), ey - r * Math.sin(la)]; };
      c.strokeStyle = 'rgba(150,170,255,0.45)'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i <= 50; i++) { const [x, y] = pt(-1.05 + 2.1 * i / 50); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      const eg = c.createRadialGradient(ex - er * 0.4, ey - er * 0.4, 1, ex, ey, er); eg.addColorStop(0, '#3b7fc0'); eg.addColorStop(1, '#0c2742'); c.fillStyle = eg; c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fill();
      const T2 = 3.2, q = (t % T2) / T2, lam = 1.0 * q, toPt = l2 => { const [x2, y2] = pt(l2), [x3, y3] = pt(l2 + 1e-3), tl = Math.hypot(x3 - x2, y3 - y2) || 1; return [x2, y2, -(y3 - y2) / tl, (x3 - x2) / tl]; };
      c.strokeStyle = 'rgba(120,210,255,0.55)'; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i <= 60; i++) { const l2 = lam * i / 60, [x2, y2, nx, ny] = toPt(l2), w2 = Math.sin(t * 26 - (lam - l2) * 90) * 6 * (1 - 0.6 * l2); i ? c.lineTo(x2 + nx * w2, y2 + ny * w2) : c.moveTo(x2 + nx * w2, y2 + ny * w2); }
      c.stroke();
      { const [x2, y2, nx, ny] = toPt(lam), w2 = Math.sin(t * 26) * 6 * (1 - 0.6 * lam); glow(c, x2 + nx * w2, y2 + ny * w2, 7, '120,210,255', 0.95); }
      if (q > 0.9) { const [fx, fy] = pt(1.0); glow(c, fx, fy, 14, '90,255,140', 0.8); }
      text(c, 'the aurora', 10, 15, { size: 13 });
      text(c, o.b, 10, 33, { size: 12, color: '#9df5b8' });
      text(c, o.f, 10, 50, { size: 12, color: '#9df5b8' });
      text(c, 'no dees: it slides along B as it circles', 10, h - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
    });
  }
  // your cyclotron: B stays, the circle grows. The LHC: the circle stays, B grows
  function drawLinkLHC(c, W, H, t) {
    twoPanels(c, W, H, t, panelCyclo('B stays the same, the circle grows'), (c, w, h, t) => {
      const T = 4, f = (t % T) / T, Bf = ease(f < 0.8 ? f / 0.8 : 1), rx = w * 0.62, ry = h * 0.56, rr = Math.min(w * 0.2, h * 0.34);
      c.save(); c.shadowColor = `rgba(255,170,60,${0.3 + 0.5 * Bf})`; c.shadowBlur = 4 + 12 * Bf;
      c.strokeStyle = `rgba(255,176,32,${0.25 + 0.65 * Bf})`; c.lineWidth = 3 + 3 * Bf; c.beginPath(); c.arc(rx, ry, rr, 0, TAU); c.stroke(); c.restore();
      for (const [sg, col] of [[1, '120,200,255'], [-1, '255,120,110']]) { const a = sg * t * 2.2; glow(c, rx + Math.cos(a) * rr, ry + Math.sin(a) * rr, 7, col, 0.95); }
      const bx = w - 22, bh = h * 0.5, by = h * 0.3; c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(bx, by, 8, bh); c.fillStyle = lamp(); const fr = 0.065 + 0.935 * Bf; c.fillRect(bx, by + bh * (1 - fr), 8, bh * fr);
      text(c, 'the LHC', 10, 15, { size: 13 });
      text(c, `B = ${pl(0.535 + (8.09 - 0.535) * Bf, 2)} T`, 10, 33, { size: 12, color: '#ffd590' });
      text(c, 'goes round 11,245 times a second', 10, 50, { size: 12, color: '#9df5b8' });
      text(c, 'the 27 km ring stays, B grows', 10, h - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
    });
  }
  // two lanes that move together: your coil gun on top, the real machine below; a coil lights up while it pulls
  function drawLinkGauss(c, W, H, t, kind) {
    linkBack(c, W, H);
    const g = CL.screens.gauss && CL.screens.gauss.S, nCoil = g ? g.stages : 4, T = 3.4, f = ease(clamp((t % T) / (T * 0.85), 0, 1));
    const narrow = W < 520, x0 = narrow ? 10 : Math.min(160, W * 0.28), x1 = W - 12;
    const lanes = [
      { y: narrow ? H * 0.34 : H * 0.32, n: nCoil, label: 'your coil gun', sub: `${nCoil} coil${nCoil > 1 ? 's' : ''}, one iron slug`, big: true },
      { y: narrow ? H * 0.82 : H * 0.74, n: kind === 'maglev' ? 30 : 26, label: kind === 'maglev' ? 'maglev guideway' : 'EMALS in the deck', sub: kind === 'maglev' ? 'coils along the whole track' : 'a row of coils 91 m long', big: false },
    ];
    for (const L of lanes) {
      const pitch = (x1 - x0) / L.n, xo = x0 + f * (x1 - x0 + pitch * 0.5) - pitch * 0.5, ch = L.big ? 24 : 12;
      if (narrow) text(c, `${L.label}: ${L.sub}`, 10, L.y - (L.big ? 28 : 30), { size: 12, color: '#e6ece8' });
      else { text(c, L.label, 10, L.y - 8, { size: 13, color: '#e6ece8' }); text(c, L.sub, 10, L.y + 9, { size: 11, color: 'rgba(214,224,218,0.65)' }); }
      c.fillStyle = 'rgba(214,224,218,0.14)'; c.fillRect(x0, L.y - 1, x1 - x0, 2);
      for (let k = 0; k < L.n; k++) {
        const xc = x0 + (k + 0.5) * pitch, on = xo > xc - pitch * 1.05 && xo < xc;     // on while the load comes towards it, off once it reaches the middle
        c.fillStyle = on ? '#ffb020' : '#5a3a22'; c.fillRect(xc - pitch * 0.32, L.y - ch / 2, pitch * 0.64, ch);
        if (on) glow(c, xc, L.y, ch * 1.4, '255,176,32', 0.45);
      }
      if (L.big) { c.fillStyle = '#c3c9cd'; c.fillRect(xo - Math.min(pitch * 0.3, 14), L.y - 4, Math.min(pitch * 0.6, 28), 8); }
      else if (kind === 'maglev') {                      // a little train riding over the lit coils
        const tw = pitch * 6; c.fillStyle = '#e8ebe4'; c.beginPath(); c.moveTo(xo - tw, L.y - 4); c.lineTo(xo - tw, L.y - 16); c.lineTo(xo - 6, L.y - 16); c.quadraticCurveTo(xo + 6, L.y - 14, xo + 8, L.y - 4); c.closePath(); c.fill();
        c.fillStyle = '#1c2a36'; c.fillRect(xo - tw + 4, L.y - 13, tw - 12, 4);
      } else {                                            // the shuttle, towing a jet
        c.fillStyle = lamp(); c.fillRect(xo - 4, L.y - 4, 8, 4);
        c.fillStyle = '#a9b2b9'; c.beginPath(); c.moveTo(xo + 10, L.y - 9); c.lineTo(xo - 26, L.y - 11); c.lineTo(xo - 34, L.y - 20); c.lineTo(xo - 37, L.y - 20); c.lineTo(xo - 36, L.y - 9); c.lineTo(xo - 20, L.y - 6); c.lineTo(xo + 4, L.y - 6); c.closePath(); c.fill();
      }
    }
    if (W >= 640) text(c, 'same idea: each coil switches on as the load arrives, so the pull always comes from just ahead', x0, H - 10, { size: 11.5, color: '#ffd590' });
  }

  /* =====================================================================
     1. MAGLEV TRAIN — the Shanghai Transrapid
     ===================================================================== */
  function makeMaglev() {
    const LINES = {
      s431: { t: 'Shanghai 2004–21', s: 'up to 431 km/h', v: 431, km: 30.5 },
      s300: { t: 'Shanghai today', s: 'up to 300 km/h', v: 300, km: 30.5 },
      fast: { t: 'Flat out', s: '505 km/h, 60 km', v: 505, km: 60 },
    };
    // cur: current in the track coils, % of the real line's (not published: 100 % is the current that gives the
    // 44 kN per section fitted to the real acceleration). The pull of a synchronous motor is proportional to it.
    const p = { line: 's431', sections: 6, pax: 574, v: 431, km: 30.5, brake: 1.5, cur: 100, power: 20 };
    const thr = () => 44 * p.cur / 100;                  // kN of pull per section
    const TAU_V = R.ML.tau * 10, SEC = 1200;             // coils drawn 10× bigger; winding sections about 1.2 km long
    let d, st, hist, pred, scene = 0, lensX = 0, ctlPax, segLine, checkKey = '', checkCache = null;
    const params = (vKmh, km) => ({ sections: p.sections, pax: p.pax, vSet: vKmh / 3.6, length: km * 1e3, brake: p.brake, thrustPerSec: thr() * 1e3, power: p.power * 1e6 });
    function trip(vKmh, km) {
      const dd = R.mlSetup(params(vKmh, km)), s2 = R.mlInit(), pts = [[0, 0]];
      let next = 2;
      while (!s2.done && s2.t < 7200) { R.mlStep(s2, dd, 0.05); if (s2.t >= next) { pts.push([s2.t, s2.v]); next += 2; } }
      pts.push([s2.t, 0]);
      return { d: dd, st: s2, pts };
    }
    const shanghai = () => Math.abs(p.km - 30.5) < 1e-6;
    const ROAD_V = 30 / 3.6;                              // m/s: about an hour for the airport's 30 km by road (Pudong government)
    const roadT = () => p.km * 1e3 / ROAD_V;
    const ends = () => shanghai() ? ['Longyang Road', 'Pudong Airport'] : ['Start', 'End'];
    function reset() { d = R.mlSetup(params(p.v, p.km)); st = R.mlInit(); hist = [[0, 0]]; pred = trip(p.v, p.km); }
    function step(dts) {
      let left = dts;
      while (left > 1e-9 && !st.done) { const h = Math.min(0.05, left); R.mlStep(st, d, h); left -= h; if (st.t - hist[hist.length - 1][0] >= 0.5) hist.push([st.t, st.v]); }
      if (st.done && hist[hist.length - 1][1] !== 0) hist.push([st.t, 0]);
      return st.done;
    }
    const lineOf = () => Object.keys(LINES).find(k => Math.abs(LINES[k].v - p.v) < 0.6 && LINES[k].km === p.km) || '';
    const real = () => shanghai() && p.sections === 6 && p.cur === 100 && p.power === 20 && p.brake === 1.5 && (Math.round(p.v) === 431 || Math.round(p.v) === 300);
    function sideNotes() {
      const pill = $('#rsMlPill'); if (pill) pill.textContent = `${p.sections} sections · ${pl(d.m / 1000, 3)} t`;
      const n = $('#rsMlMass'); if (n) n.innerHTML = `Train ${pl(d.trainLen, 3)} m long, <b>${pl(d.m / 1000, 3)} t</b> (${p.sections} × 60 t plus ${p.pax} passengers at 80 kg). Seats: ${R.seats(p.sections)}.`;
      const fN = $('#rsMlFNote'); if (fN) fN.innerHTML = `The pull travels along the track at <b>2τf = ${pl(p.v, 3)} km/h</b>, and the train rides with it (τ = ${R.ML.tau} m between poles).`;
      const iN = $('#rsMlINote'); if (iN) iN.innerHTML = `Pull of the whole train: <b>${si(p.sections * thr() * 1e3, 'N', 3)}</b> (${pl(thr(), 3)} kN per section). More current, stronger magnets, stronger pull: like the current in your Gauss gun.${p.cur > 100 ? ' Real coils run close to their heat limit, so this is a what-if.' : ''}`;
      const ln = $('#rsMlLineNote'); if (ln) ln.textContent = p.line === 's300' ? 'Since May 2021 the line runs at 300 km/h: 8 min 10 s.' : p.line === 's431' ? 'From 2004 to May 2021 the trains ran at up to 431 km/h: 7 min 20 s.' : p.line === 'fast' ? 'The Shanghai trains are authorised for up to 505 km/h; the real line is too short to reach it.' : 'Your own run.';
    }
    const sim = {
      go: 'Depart', speeds: [['1', 'Real time'], ['10', '10× faster'], ['30', '30× faster']], speed0: '10',
      canvasLabel: 'Side view of the maglev train on its guideway, with the speed, the frequency of the travelling field and a close-up of the magnetic gap',
      graphs: ['Speed during the trip', 'Motor pull and air drag'],
      side() {
        return `<div class="panel"><div class="panel-title">Which run?</div>${segHTML('ml-line', 'Which run', Object.entries(LINES).map(([k, L]) => [k, L.t, L.s]), 'seg-3')}<p class="hint" id="rsMlLineNote"></p></div>
          <details class="acc tag-copper" open><summary><span class="acc-title">Coils in the track</span><span class="acc-pill">like a Gauss gun</span></summary><div class="acc-body">
            ${ctl('ml-f', 'How fast the coils switch', 'Hz')}<p class="hint" id="rsMlFNote"></p>
            ${ctl('ml-i', 'Current in the coils', '%')}<p class="hint" id="rsMlINote"></p>
            <p class="hint" data-level="beginner">Faster switching makes the pull move faster, so the train goes faster. More current makes the pull stronger, so it speeds up sooner.</p></div></details>
          <details class="acc tag-particle" open><summary><span class="acc-title">Train</span><span class="acc-pill" id="rsMlPill"></span></summary><div class="acc-body">
            <div data-level="expert">${ctl('ml-sec', 'Sections', '', 'numeric')}</div>${ctl('ml-pax', 'Passengers', '', 'numeric')}<p class="hint" id="rsMlMass"></p></div></details>
          <details class="acc tag-rf" data-level="expert"><summary><span class="acc-title">Line and motor</span><span class="acc-pill">estimated</span></summary><div class="acc-body">
            ${ctl('ml-km', 'Length of the line', 'km')}${ctl('ml-br', 'Braking limit', 'm/s²')}${ctl('ml-pw', 'Converter power', 'MW')}
            <p class="hint">The coil current at 100 % and the converter power are not published. They were set once so the model accelerates like the real train (300 km/h in 2 min 15 s, 431 km/h in about 4 min); everything else follows from the physics.</p></div></details>`;
      },
      bind(changed) {
        segLine = segInit($('#rs-ml-line'), () => p.line, v => { p.line = v; p.v = LINES[v].v; p.km = LINES[v].km; ctlF.sync(); ctlKm.sync(); changed(); });
        range('ml-sec', { min: 2, max: 10, step: 1, int: true, get: () => p.sections, set: v => { const full = p.pax >= R.seats(p.sections); p.sections = v; p.pax = full ? R.seats(v) : Math.min(p.pax, R.seats(v)); ctlPax.setLimits(0, R.seats(v)); changed(); } });
        ctlPax = range('ml-pax', { min: 0, max: R.seats(p.sections), step: 1, int: true, get: () => p.pax, set: v => { p.pax = v; changed(); } });
        const ctlF = range('ml-f', { min: 20, max: 270, step: 1, int: true, get: () => Math.round(R.mlFreq(p.v / 3.6)), set: f => { p.v = Math.round(f * 2 * R.ML.tau * 36) / 10; p.line = lineOf(); segLine.sync(); changed(); } });
        range('ml-i', { min: 20, max: 150, step: 5, int: true, get: () => p.cur, set: v => { p.cur = v; changed(); } });
        const ctlKm = range('ml-km', { min: 2, max: 60, step: 0.5, get: () => p.km, set: v => { p.km = v; p.line = lineOf(); segLine.sync(); changed(); } });
        range('ml-br', { min: 0.2, max: 1.5, step: 0.05, get: () => p.brake, set: v => { p.brake = v; changed(); } });
        range('ml-pw', { min: 2, max: 60, step: 0.5, get: () => p.power, set: v => { p.power = v; changed(); } });
      },
      reset() { reset(); sideNotes(); },
      step,
      draw(c, W, H, dtr, running) {
        if (running) { scene += st.v * dtr; lensX += st.v * dtr / 400; }
        drawMaglev(c, W, H);
      },
      clock: () => `t = ${mmss(st.t)}`,
      status() {
        const e = ends();
        if (st.phase === 'ready') return [`Ready at ${e[0]}`, ''];
        if (st.done) return [`Arrived at ${e[1]} after ${mmss(st.t)}`, 'is-good'];
        const k = `${pl(st.v * 3.6, 3)} km/h`;
        return st.phase === 'brake' ? [`Braking · ${k}`, 'is-warn'] : st.phase === 'cruise' ? [`Cruising · ${k}`, 'is-run'] : st.phase === 'top' ? [`Flat out · ${k}`, 'is-warn'] : [`Accelerating · ${k}`, 'is-run'];
      },
      narrate() {
        const f = R.mlFreq(st.v), e = ends();
        if (simple()) {
          if (st.phase === 'ready') return `The track is lined with coils, a Gauss gun 30 km long. Their current makes a magnetic pull that <b>moves along the track</b>, and the magnets under the train ride along with it, just as your Gauss gun’s slug is pulled from coil to coil. You set how fast the coils switch (<b>${Math.round(R.mlFreq(p.v / 3.6))} times a second</b>, so ${pl(p.v, 3)} km/h) and how much current they carry (<b>${p.cur} %</b>). Press <b>Depart</b>.`;
          if (st.done) return `Arrived after <b>${mmss(st.t)}</b>, an average of ${pl(p.km * 1e3 / st.t * 3.6, 3)} km/h.${real() ? ` The real train takes ${Math.round(p.v) === 431 ? '7 min 20 s' : '8 min 10 s'}.` : ''}`;
          if (st.phase === 'brake') return `Braking: the moving field now sits just <b>behind</b> the train’s magnets, so it pulls them backwards. That is the “suck-back” a Gauss gun tries to avoid, used here on purpose. ${pl(st.v * 3.6, 3)} km/h.`;
          if (st.phase === 'cruise') return `Cruising at ${pl(st.v * 3.6, 3)} km/h. Now the coils only have to make up for the air pushing back.`;
          if (st.phase === 'top') return `Flat out: the air now pushes back as hard as the coils pull, so the train can’t go faster than about ${pl(d.vBal * 3.6, 3)} km/h.${Math.sqrt(d.Fmax / d.k) <= Math.cbrt(d.P / d.k) + 1e-9 ? ' Give the coils more current to pull harder.' : ''}`;
          if (st.v < d.vKnee) return `Speeding up at ${pl(st.a, 2)} m/s². The pull moves along the track just ahead of the train. To go faster, the coils must switch faster: <b>${pl(f, 3)} times a second</b> now.`;
          return `Still speeding up, but more slowly: the motor is at full power and the air pushes back harder and harder (drag grows with v²). ${pl(st.v * 3.6, 3)} km/h.`;
        }
        if (st.phase === 'ready') return `The guideway’s three-phase coils make a magnetic field that <b>travels along the track</b>; the electromagnets under the train lock onto it and are pulled along, just as your Gauss gun’s slug chases the next coil. Speed is set by frequency: <b>v = 2τf</b>, with a pole pitch τ of about ${R.ML.tau} m. Press <b>Depart</b> to run ${pl(p.km, 3)} km from ${e[0]} to ${e[1]}.`;
        if (st.done) { const rl = real() ? ` The real train needs <b>${Math.round(p.v) === 431 ? '7 min 20 s' : '8 min 10 s'}</b> for this run.` : ''; return `Arrived after <b>${mmss(st.t)}</b>, an average of ${pl(p.km * 1e3 / st.t * 3.6, 3)} km/h.${rl} The motor did ${pl(st.Edrive / 3.6e6, 3)} kWh of work; ${Math.round(st.Edrag / st.Edrive * 100)} % of it went into pushing air aside, and braking as a generator could send up to ${pl(st.Ebrake / 3.6e6, 3)} kWh back to the line.`; }
        if (st.phase === 'brake') return `Braking: the control centre shifts the travelling field so that it <b>lags just behind</b> the train’s magnets, which are now pulled backwards, and lowers the frequency as the train slows. The motor works as a generator and can feed energy back to the line. Deceleration ${pl(-st.a, 2)} m/s²; field ${pl(f, 3)} Hz.`;
        if (st.phase === 'cruise') return `Cruising at ${pl(st.v * 3.6, 3)} km/h. The motor only has to replace what air drag takes: ${si(st.D, 'N', 3)}, which at ${pl(st.v, 3)} m/s is <b>${si(st.D * st.v, 'W', 3)}</b>. Levitating and guiding the ${pl(d.m / 1000, 3)} t train takes only about ${si(R.ML.lev * d.m / 1000, 'W', 2)}.`;
        if (st.phase === 'top') return `Flat out: air drag (${si(st.D, 'N', 3)}) now takes almost all of the motor’s pull, so the train cannot go much faster than about <b>${pl(d.vBal * 3.6, 3)} km/h</b>, below the ${pl(p.v, 3)} km/h of the switching rate you set. ${Math.sqrt(d.Fmax / d.k) <= Math.cbrt(d.P / d.k) + 1e-9 ? `Here the coil current limits it: ${p.cur} % gives ${si(d.Fmax, 'N', 3)}, and drag reaches that at ${pl(d.vBal * 3.6, 3)} km/h. The control centre stops raising the frequency there, or the field would run away from the magnets and the train would fall out of step.` : 'Here the converters’ power limits it: drag grows as v², the power it needs as v³.'}`;
        if (st.v < d.vKnee) return `Accelerating at ${pl(st.a, 2)} m/s². The motor gives its full pull of <b>${si(d.Fmax, 'N', 3)}</b> (${pl(thr(), 3)} kN on each section at ${p.cur} % current) and the control centre raises the frequency to keep the field just ahead of the magnets: now <b>${pl(f, 3)} Hz</b>.`;
        return `Above ${pl(d.vKnee * 3.6, 3)} km/h the converters are at full power (${pl(p.power, 3)} MW), so the pull falls as <b>P/v</b> while air drag grows as v²: acceleration is down to ${pl(st.a, 2)} m/s². Field frequency ${pl(f, 3)} Hz.`;
      },
      tiles() {
        const f = R.mlFreq(st.v), P = st.F * st.v;
        return [
          ['Speed', `${pl(st.v * 3.6, 3)} km/h`, `${pl(st.v, 3)} m/s · ${st.a < 0 ? '−' : ''}${pl(Math.abs(st.a), 2)} m/s²`],
          ['Travelling field', `${pl(f, 3)} Hz`, `wave speed 2τf = ${pl(2 * R.ML.tau * f, 3)} m/s`],
          ['Motor power', P >= 0 ? si(P, 'W', 3) : `−${si(-P, 'W', 3)}`, `${st.F >= 0 ? 'pull' : 'braking'} ${si(Math.abs(st.F), 'N', 3)} · drag ${si(st.D, 'N', 3)}`],
          ['Trip', mmss(st.t), `${pl(st.x / 1e3, 3)} of ${pl(p.km, 3)} km`],
        ];
      },
      graphA(cv) {
        const tMax = Math.max(pred.st.t, st.t, 60) * 1.02;
        const r = plot(cv, { xmin: 0, xmax: tMax, xf: 60, ymin: 0, ymax: 560, xlabel: 'time (min)', ylabel: 'speed (km/h)', pad: { r: 16 },
          series: [{ pts: pred.pts.map(([t, v]) => [t, v * 3.6]), color: 'rgba(210,220,214,0.45)', width: 1.3, dash: [4, 4] }, { pts: hist.map(([t, v]) => [t, v * 3.6]), color: lamp(), width: 2.4, dot: st.phase !== 'ready' && !st.done }] });
        if (!r) return;
        const c = r.ctx;
        for (const [v, t] of [[300, 'Shanghai today 300'], [431, 'record service 431'], [505, 'allowed 505']]) {
          const y = Math.round(r.YP(v)) + 0.5; c.strokeStyle = 'rgba(255,210,120,0.28)'; c.setLineDash([2, 5]); c.lineWidth = 1; c.beginPath(); c.moveTo(r.pad.l, y); c.lineTo(r.W - r.pad.r, y); c.stroke(); c.setLineDash([]);
          c.fillStyle = 'rgba(255,214,140,0.75)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(t, r.W - r.pad.r - 4, y - 2);
        }
        c.fillStyle = 'rgba(210,220,214,0.6)'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('dashed: the whole trip, worked out in advance', r.pad.l + 6, r.pad.t + 18);
      },
      graphB(cv) {
        const vTop = Math.max(560, d.vBal * 3.6 * 1.06), thr = [], drg = [];
        for (let i = 0; i <= 160; i++) { const v = i / 160 * vTop / 3.6; thr.push([v * 3.6, R.mlThrust(d, v) / 1e3]); drg.push([v * 3.6, d.k * v * v / 1e3]); }
        const ymax = d.Fmax / 1e3 * 1.18;
        const r = plot(cv, { xmin: 0, xmax: vTop, ymin: 0, ymax, xlabel: 'speed (km/h)', ylabel: 'force (kN)', pad: { r: 16 },
          series: [{ pts: thr, color: lamp(), width: 2.2 }, { pts: drg, color: '#5cc8ff', width: 2.2 }],
          vlines: [{ x: d.vKnee * 3.6, label: 'full power', color: 'rgba(255,214,140,0.55)' }, { x: d.vBal * 3.6, label: `top ≈ ${pl(d.vBal * 3.6, 3)}`, color: 'rgba(120,210,255,0.7)' }] });
        if (!r) return;
        const c = r.ctx, v = st.v;
        c.font = '600 11px "Barlow", sans-serif'; c.textBaseline = 'bottom'; c.textAlign = 'left';
        c.fillStyle = lamp(); c.fillText('best pull of the motor', r.XP(d.vKnee * 3.6 * 0.3), r.YP(d.Fmax / 1e3) - 3);
        const vd = Math.min(vTop * 0.55, d.vBal * 3.6 * 0.62); c.fillStyle = '#5cc8ff'; c.fillText('air drag ½ρ·Cd·A·v²', r.XP(vd), r.YP(d.k * Math.pow(vd / 3.6, 2) / 1e3) - 4);
        if (st.phase !== 'ready' && !st.done) {
          const F = Math.abs(st.F) / 1e3, x = r.XP(v * 3.6);
          c.fillStyle = '#fff'; c.strokeStyle = st.F >= 0 ? lamp() : '#ff7b6b'; c.lineWidth = 2;
          c.beginPath(); c.arc(x, r.YP(F), 4.5, 0, TAU); c.fill(); c.stroke();
          c.beginPath(); c.arc(x, r.YP(st.D / 1e3), 3.5, 0, TAU); c.fillStyle = '#5cc8ff'; c.fill();
        }
      },
      numbers() {
        const m = d.m, f = R.mlFreq(st.v), vb = d.vBal;
        let h = sec('The train');
        h += row('Mass', `${pl(m / 1000, 4)} t`, `${p.sections} sections of about 60 t (the two-section Transrapid 06 weighed 120 t) and ${p.pax} passengers of 80 kg. Both are estimates; the real mass of the Shanghai trains is not published.`, `m = ${p.sections} × 60,000 kg + ${p.pax} × 80 kg = ${pl(m, 6)} kg`);
        h += row('Length', `${pl(d.trainLen, 4)} m`, 'Each section is about 25.6 m: the six-section Shanghai train is 153.6 m long.', '');
        h += row('Air drag', `C<sub>d</sub>A = ${pl(d.CdA, 3)} m²`, 'Nose and tail, plus friction along the sides that grows with every section (an estimate). Drag force is ½ρC<sub>d</sub>A v².', `½ρC<sub>d</sub>A = ½ × ${R.ML.rho} kg/m³ × ${pl(d.CdA, 3)} m² = ${pl(d.k, 3)} kg/m, so at 431 km/h: ${pl(d.k, 3)} × (119.7 m/s)² = ${si(d.k * 119.72 * 119.72, 'N', 3)}`);
        h += row('Floating', '10 mm gap', 'Electromagnets on the train hang under the guideway and pull up towards it. An electronic control system keeps adjusting their current to hold the gap at about 10 mm; the underside of the train clears the top of the guideway by 150 mm.', `lift needed = mg = ${pl(m, 4)} kg × 9.81 m/s² = ${si(m * G0, 'N', 3)}; levitation and guidance power ≈ 1.7 kW per tonne = ${si(R.ML.lev * m / 1000, 'W', 3)}`);
        h += sec('The motor');
        h += row('Travelling field', `${pl(f, 4)} Hz now`, 'Three-phase current in the guideway makes north and south poles that march along the track. The train’s magnets lock onto them, so the train moves exactly as fast as the wave.', `v = 2τf → f = v / 2τ = ${pl(st.v, 4)} m/s / (2 × ${R.ML.tau} m) = ${pl(f, 4)} Hz. The pole pitch τ ≈ 0.26 m is inferred: the converters go up to 270 Hz, and 2 × 0.26 m × 270 Hz = ${pl(2 * R.ML.tau * 270 * 3.6, 3)} km/h, the trains’ top speed.`);
        h += row('Best pull', si(d.Fmax, 'N', 3), `Set by the current in the track coils: ${pl(thr(), 3)} kN for each section at ${p.cur} % (100 % = 44 kN, estimated). The pull of a synchronous motor is proportional to the current.`, `F<sub>max</sub> = ${p.sections} × 44 kN × ${p.cur} % = ${si(d.Fmax, 'N', 3)} → a = F/m = ${pl(d.Fmax / m, 3)} m/s² from a standstill`);
        h += row('Full power from', `${pl(d.vKnee * 3.6, 3)} km/h`, `Above this speed the converters’ power (${pl(p.power, 3)} MW, estimated) runs out, so the pull is P/v.`, `v = P / F<sub>max</sub> = ${si(d.P, 'W', 3)} / ${si(d.Fmax, 'N', 3)} = ${pl(d.vKnee, 3)} m/s`);
        h += row('Top speed this train could reach', `${pl(vb * 3.6, 3)} km/h`, 'Where the motor’s pull equals air drag. The Shanghai trains are only allowed 505 km/h.', `P/v = ½ρC<sub>d</sub>A v² → v = ∛(P / ½ρC<sub>d</sub>A) = ∛(${si(d.P, 'W', 3)} / ${pl(d.k, 3)} kg/m) = ${pl(vb, 3)} m/s`);
        h += sec('This trip');
        const done = st.done, s0 = done ? st : pred.st;
        h += row(done ? 'Trip time' : 'Trip time (worked out ahead)', mmss(s0.t), `${pl(p.km, 3)} km at up to ${pl(p.v, 3)} km/h: average ${pl(p.km * 1e3 / s0.t * 3.6, 3)} km/h.`, '');
        if (s0.marks.k300) h += row('Reached 300 km/h', `${mmss(s0.marks.k300.t)}, after ${pl(s0.marks.k300.x / 1e3, 3)} km`, '', '');
        if (s0.marks.k431) h += row('Reached 431 km/h', `${mmss(s0.marks.k431.t)}, after ${pl(s0.marks.k431.x / 1e3, 3)} km`, '', '');
        h += row('Kinetic energy at top speed', `${pl(0.5 * m * s0.vmax * s0.vmax / 3.6e6, 3)} kWh`, '', `½mv² = ½ × ${pl(m, 4)} kg × (${pl(s0.vmax, 4)} m/s)² = ${si(0.5 * m * s0.vmax * s0.vmax, 'J', 3)}`);
        h += row('Work done by the motor', `${pl(s0.Edrive / 3.6e6, 3)} kWh`, `${Math.round(s0.Edrag / s0.Edrive * 100)} % of it is lost to air drag; the rest becomes kinetic energy, and braking as a generator can recover up to ${pl(s0.Ebrake / 3.6e6, 3)} kWh of that. Losses in the motor and converters are not included.`, `W = Σ F·Δx; air drag took Σ D·Δx = ${pl(s0.Edrag / 3.6e6, 3)} kWh`);
        if (p.pax > 0) h += row('Per passenger', `${pl(s0.Edrive / 3.6e6 / p.pax * 1000, 3)} Wh`, `For ${pl(p.km, 3)} km, before anything is recovered by braking.`, '');
        h += row('Levitation and guidance', `${pl(s0.Elev / 3.6e6, 3)} kWh`, 'About 1.7 kW per tonne for as long as the train floats: small next to drag at speed.', `${si(R.ML.lev * m / 1000, 'W', 3)} × ${mmss(s0.t)}`);
        return h;
      },
      check() {
        const key = [p.sections, p.pax, p.cur, p.power, p.brake].join();
        if (key !== checkKey) { checkKey = key; checkCache = { a: trip(431, 30.5), b: trip(300, 30.5) }; }
        const a = checkCache.a.st, b = checkCache.b.st, ok = (x, y, tol) => Math.abs(x - y) <= tol * y ? 'good' : 'warn';
        let h = `<p class="hint">Your train run on the real 30.5 km Shanghai line, against the published numbers. The motor’s strength was set once to match the first two lines; the rest are predictions.</p>`;
        h += cmpTable([
          ['0 to 300 km/h', a.marks.k300 ? mmss(a.marks.k300.t) : 'not reached', '2 min 15 s', 'shanghai', a.marks.k300 ? ok(a.marks.k300.t, 135, 0.05) : 'bad'],
          ['0 to 431 km/h', a.marks.k431 ? mmss(a.marks.k431.t) : 'not reached', 'about 4 min', 'shanghai', a.marks.k431 ? ok(a.marks.k431.t, 240, 0.06) : 'bad'],
          ['Distance to reach 300 km/h', a.marks.k300 ? `${pl(a.marks.k300.x / 1e3, 2)} km` : '–', 'about 5 km', 'ieee', a.marks.k300 ? ok(a.marks.k300.x, 5000, 0.2) : 'bad'],
          ['Trip at up to 431 km/h', mmss(a.t), '7 min 20 s', 'shanghai', ok(a.t, 440, 0.04)],
          ['Trip at up to 300 km/h', mmss(b.t), '8 min 10 s', 'shanghai', ok(b.t, 490, 0.04)],
          ['Gap under the guideway', '10 mm', 'about 10 mm', 'tri'],
          ['Frequency at 505 km/h (sets the pole pitch)', `${pl(R.mlFreq(505 / 3.6), 3)} Hz`, 'converters run up to 270 Hz', 'wctr'],
          ['Fastest maglev ever', '–', '603 km/h (Japan’s L0, 2015, a different superconducting design)', 'maglev'],
        ]);
        h += `<p class="hint">Green: within a few per cent of the real train. The real line also has curves and gentler acceleration near the stations, which this model leaves out.</p>`;
        return h;
      },
      keyNumbers() {
        const m = d.m, v = p.v / 3.6, f = R.mlFreq(v), K = 0.5 * m * v * v;
        return row('Coils switching', `${pl(f, 3)} times a second`, `Each switch moves the pull ${pl(2 * R.ML.tau, 2)} m along the track, so the pull, and the train, travel at v = 2τf = ${pl(2 * R.ML.tau, 2)} m × ${pl(f, 3)} /s = ${pl(v * 3.6, 3)} km/h.`)
          + row('Strongest pull', si(d.Fmax, 'N', 3), `From the current in the coils (${p.cur} %). F = ma: a = F/m = ${pl(d.Fmax / m, 3)} m/s² when it sets off.`)
          + row('Mass of the train', `${pl(m / 1000, 3)} t`, `${p.sections} sections and ${p.pax} passengers (an estimate).`)
          + row('Kinetic energy at top speed', si(K, 'J', 3), `½mv², the same formula as your Gauss gun’s slug, with a train instead of a ${gaussNow() ? pl(gaussNow().r.m * 1000, 2) + ' g' : 'small'} slug.`)
          + row('Trip time', mmss((st.done ? st : pred.st).t), `${pl(p.km, 3)} km at up to ${pl(Math.min(p.v, d.vBal * 3.6), 3)} km/h.`);
      },
      link(sm) {
        const gn = gaussNow(), r = gn && gn.r, g = gn && gn.g, v = p.v / 3.6;
        const rows = [
          ['What pulls', g ? `${g.stages} coil${g.stages > 1 ? 's' : ''} of ${g.turns} turns, ${g.current} A` : 'coils in a row', `coils along the whole track, at ${p.cur} % current`],
          ['How the pull moves', 'each coil switches on as the slug arrives', `the coils switch ${Math.round(R.mlFreq(p.v / 3.6))} times a second, so the pull moves at 2τf`],
          ['What is pulled', r ? `an iron slug, ${pl(r.m * 1000, 3)} g` : 'an iron slug', `magnets on a ${pl(d.m / 1000, 3)} t train`],
          ['Top speed', r ? `${pl(r.vExit, 3)} m/s` : '–', `${pl(Math.min(v, d.vBal), 3)} m/s (${pl(Math.min(p.v, d.vBal * 3.6), 3)} km/h)`],
          ['Kinetic energy, ½mv²', r ? si(r.K, 'J', 3) : '–', si(0.5 * d.m * v * v, 'J', 3)],
        ];
        if (!sm) rows.push(
          ['Pulling backwards', 'suck-back, if a coil stays on too long', 'used on purpose to brake: the field is put behind the magnets'],
          ['Length', `about ${pl(Math.max(1, g ? g.stages : 4) * 6.5, 2)} cm of coils`, `${pl(p.km, 3)} km of track`]);
        return {
          title: 'How is the maglev a Gauss gun?',
          text: sm ? 'Your coil gun and the maglev work the same way: <b>coils switch on one after another</b>, so the magnetic pull is always just ahead of the thing they move. Your gun pulls a small iron slug through a few coils; the maglev’s track pulls the magnets of a whole train, all the way along a 30 km line.'
            : `Both are linear electromagnetic motors: current in a row of coils makes a magnetic pull that is switched along the row in step with the load. In your coil gun light gates switch each coil on and it goes off at the coil’s middle. The Transrapid uses a long-stator linear synchronous motor: three-phase current in the guideway makes a field that travels at v = 2τf, and the train’s electromagnets lock onto it. Same F = ma and ½mv²${r && r.K > 0 ? `; about 10${CL.PHYS.sup(Math.round(Math.log10(0.5 * d.m * v * v / r.K)))} times more kinetic energy` : ''}.`,
          cols: ['Your coil gun', 'Maglev train'], rows, alt: 'Animation: your coil gun’s coils light up one after another as the slug passes, and so do the coils along the maglev track under the train', draw: (c, W, H, t) => drawLinkGauss(c, W, H, t, 'maglev'),
        };
      },
      sources: ['shanghai', 'ieee', 'dewe', 'tri', 'wctr', 'meis', 'transrapid', 'maglev', 'stator'],
      whySources: ['pudong'],
      why(sm) {
        const tM = pred.st.t, tR = roadT();
        // the real timetable changed in May 2021 (431 → 300 km/h), so say which train these numbers are
        const trip = real() && Math.round(p.v) === 431
          ? (sm ? 'From 2004 to 2021 the maglev did it in about 7 minutes; today, at up to 300 km/h, it takes about 8.'
            : 'From 2004 to May 2021 the maglev covered its 30.5 km in 7 min 20 s at up to 431 km/h; since then it has run at up to 300 km/h and takes 8 min 10 s.')
          : real() ? (sm ? 'The maglev does it in about 8 minutes.'
            : 'Since May 2021 the maglev has covered its 30.5 km in 8 min 10 s at up to 300 km/h (from 2004, 7 min 20 s at up to 431 km/h).')
          : (sm ? `In this run the maglev covers ${pl(p.km, 3)} km in about ${Math.max(1, Math.round(tM / 60))} minutes; the real train takes about 8 for its 30 km.`
            : `In this run the maglev covers ${pl(p.km, 3)} km in ${mmss(tM)}; the real train takes 8 min 10 s for its 30.5 km, at up to 300 km/h.`);
        return {
          q: 'Why build a floating train to the airport?',
          a: sm ? `Shanghai’s Pudong Airport is about 30 km from the city centre: about an hour by road. ${trip} Nothing touches the track: magnets hold the train 10 mm away, and coils in the track pull it along, a Gauss gun 30 km long, so there are no wheels to slip or wear out.`
            : `Pudong Airport is about 30 km from the centre of Shanghai, about an hour by road (Pudong government). ${trip} It rides 10 mm from the guideway and is pulled by a travelling magnetic field, v = 2τf, from coils switched one after another: nothing rubs, so there is no wheel to slip and the push does not depend on grip.`,
          metric: `Time for ${pl(p.km, 3)} km`,
          rows: [
            { k: 'off', label: 'By road (city traffic, about 30 km/h)', v: tR / 60, txt: `about ${Math.round(tR / 60)} min` },
            { k: 'on', label: 'By maglev (this run)', v: tM / 60, txt: mmss(tM) },
          ],
          verdict: `Every passenger saves about <b>${Math.round((tR - tM) / 60)} minutes</b> a trip. Watch the car at the bottom of the view.`,
        };
      },
      helps() {
        const tM = pred.st.t, tR = roadT();
        return [
          ['clock', 'Travellers', `About ${Math.round((tR - tM) / 60)} minutes saved on every trip: about ${Math.round(tR / 60)} min by road, ${mmss(tM)} by maglev in this run.`, 'pudong'],
          ['track', 'No wear', 'Nothing touches the guideway: magnets hold the train 10 mm away and the coils pull it, so no wheels rub, slip or wear.', 'tri'],
        ];
      },
      get st() { return st; },
      home3d: { yaw: -0.78, pitch: 0.07, dist: 25, target: [-11, 0, 6.8], fov: 50, minDist: 3, maxDist: 700 },
      draw3d(sc, c, W, H, dtr, running) {
        if (running) { scene += st.v * dtr; lensX += st.v * dtr / 400; }
        drawMaglev3d(sc, c, W, H);
      },
    };

    /* ---- 3D: the train on its guideway, with the skirt drawn see-through so the Gauss part shows:
       the coils under the edges of the guideway and the magnets on the train just below them ---- */
    function drawMaglev3d(sc, c, W, H) {
      const tt = performance.now() / 1000, Lt = d.trainLen, ZT = 7.0;
      sc.begin(c, W, H, { dist: W < 600 ? sc.home.dist * 1.5 : undefined, bg: [44, 42, 66], fogNear: 2.5, fogFar: 26, fogMax: 0.7, backdrop: (g, W2, H2, hy) => drawBlueHour(g, W2, H2, hy, tt) });
      const x0 = -Lt - 260, x1 = 320, at = X => X - scene;                    // the train's nose stays at x = 0; the world slides past
      // the land: fields, their edges sliding past, and trees
      sc.poly([[-1400, -1400, 0], [1400, -1400, 0], [1400, 1400, 0], [-1400, 1400, 0]], { rgb: [26, 33, 30], shade: false, layer: 'back' });
      for (let k = Math.floor((scene + x0) / 60); k <= Math.ceil((scene + x1) / 60); k++) { const x = at(k * 60); sc.line([x, -260, 0.02], [x, 260, 0.02], 'rgba(120,150,120,0.12)', 1, { layer: 'back' }); }
      for (let k = Math.floor((scene + x0) / 23); k <= Math.ceil((scene + x1) / 23); k++) {
        for (const sd of [-1, 1]) { if (hash(k * 2 + (sd > 0 ? 1 : 0)) < 0.55) continue; const y = sd * (28 + 70 * hash(k + (sd > 0 ? 300 : 500))), x = at(k * 23 + 9 * hash(k + 77)), r = 1.4 + 1.6 * hash(k + 11);
          sc.cyl([x, y, 0], [x, y, r * 1.1], 0.2, { rgb: [52, 40, 30], flat: true }, 6); sc.sphere([x, y, r * 1.7], r, [30, 52, 38]); }
      }
      // the city far away, its windows lit
      for (let k = Math.floor((scene - 3000) / 140); k <= Math.ceil((scene + 3000) / 140); k++) {
        const x = at(k * 140), y = 900 + 500 * hash(k + 40), h = 40 + 220 * Math.pow(hash(k + 60), 2), w = 30 + 40 * hash(k + 80);
        sc.box([x, y, h / 2], [w / 2, w / 2, h / 2], { rgb: [26, 32, 50], shade: false, noFog: false });
        if (hash(k + 90) > 0.6) sc.glow([x, y, h + 6], 5, [255, 80, 60], 0.8, { px: true });
      }
      // pillars every 24.8 m and the guideway beam on top of them
      for (let k = Math.floor((scene + x0) / 24.8); k <= Math.ceil((scene + x1) / 24.8); k++) {
        const x = at(k * 24.8);
        sc.box([x, 0, 2.45], [0.75, 0.85, 2.45], { rgb: [112, 118, 118], spec: 0.05 });
        sc.box([x, 0, 5.0], [1.0, 1.2, 0.2], { rgb: [120, 126, 126] });
        const xm = x + 12.4;
        if (xm - 12.4 < x1 && xm + 12.4 > x0) { sc.box([xm, 0, 5.85], [12.38, 0.62, 0.65], { rgb: [128, 134, 134], spec: 0.05 }); sc.box([xm, 0, 6.75], [12.38, 1.4, 0.25], { rgb: [150, 156, 154], spec: 0.08 }); }
      }
      // the coils (long stator) under both edges of the guideway, drawn 10× bigger; powered sections show the travelling poles
      const lead = st.F && d.Fmax ? 0.25 * TAU_V * clamp(st.F / d.Fmax, -1, 1) : 0;
      for (let k = Math.floor((scene + x0) / TAU_V); k <= Math.ceil((scene + x1) / TAU_V); k++) {
        const X = (k + 0.5) * TAU_V, x = at(X), on = powered(X), I = Math.cos(Math.PI * (X - scene - lead) / TAU_V);
        const rgb = on ? (I > 0 ? [255, 96 + 60 * (1 - Math.abs(I)), 70] : [90, 150 + 40 * (1 - Math.abs(I)), 255]) : [96, 64, 40];
        const emit = on && Math.abs(I) > 0.35 ? (I > 0 ? '255,80,50' : '60,130,255') : null;
        for (const sd of [-1, 1]) sc.box([x, sd * 1.18, 6.38], [TAU_V * 0.4, 0.22, 0.12], { rgb, emit, emitA: on ? 0.6 * Math.abs(I) : 0, spec: 0.2, skip: n => n[2] > 0.5 });
        if (on && Math.abs(I) > 0.85 && x > -Lt - 10 && x < 20) sc.glow([x, 1.45, 6.35], 1.6, I > 0 ? [255, 110, 80] : [110, 170, 255], 0.45);
      }
      // section ends, with a marker on the guideway
      for (let n = Math.floor((scene + x0) / SEC); n <= Math.ceil((scene + x1) / SEC); n++) {
        const x = at(n * SEC);
        if (x < x0 || x > x1) continue;
        sc.box([x, 0, 7.05], [0.15, 1.42, 0.06], { rgb: [20, 22, 22] });
        sc.label([x, -1.6, 7.9], powered(n * SEC + 1) ? `section ${n + 1}: on` : `section ${n + 1}: off`, { color: powered(n * SEC + 1) ? '#ffd590' : 'rgba(214,224,218,0.7)', font: '600 12px "Barlow Condensed", "Arial Narrow", sans-serif' });
      }
      // the train: magnets under the stator, the see-through skirt, the cabin with its windows, nose and tail
      for (let k = Math.floor((scene - Lt) / TAU_V); k <= Math.ceil(scene / TAU_V); k++) {
        const X = (k + 0.5) * TAU_V, x = at(X); if (x < -Lt + 1 || x > -1) continue;
        const M = Math.cos(Math.PI * (X - scene) / TAU_V);
        for (const sd of [-1, 1]) sc.box([x, sd * 1.18, 6.14], [TAU_V * 0.32, 0.2, 0.09], { rgb: M > 0 ? [90, 150, 255] : [255, 96, 70], spec: 0.25 });
      }
      for (const sd of [-1, 1]) {
        sc.poly([[-Lt + 3, sd * 1.9, 6.0], [-1.5, sd * 1.9, 6.0], [-1.5, sd * 1.9, 7.2], [-Lt + 3, sd * 1.9, 7.2]], { rgb: [200, 214, 222], a: 0.22, out: [0, sd, 0] });
        sc.poly([[-Lt + 3, sd * 0.9, 6.0], [-1.5, sd * 0.9, 6.0], [-1.5, sd * 1.9, 6.0], [-Lt + 3, sd * 1.9, 6.0]], { rgb: [200, 214, 222], a: 0.18, out: [0, 0, -1] });
      }
      const zb = 7.2, zt = 10.3, wb = 1.85, xn = -7, xtl = -Lt + 4.5;
      const body = (pts, st2) => sc.poly(pts, Object.assign({ rgb: [236, 240, 236], amb: 0.62, spec: 0.35, shin: 30 }, st2));
      sc.box([(xn + xtl) / 2, 0, (zb + zt) / 2], [(xn - xtl) / 2, wb, (zt - zb) / 2], { rgb: [236, 240, 236], amb: 0.62, spec: 0.35, shin: 30 });
      // nose: from the full body at x = xn to a rounded tip at x = 0
      const tip = [[0, -1.0, 7.35], [0, 1.0, 7.35], [0, 1.0, 8.2], [0, -1.0, 8.2]], fr = [[xn, -wb, zb], [xn, wb, zb], [xn, wb, zt], [xn, -wb, zt]];
      body([fr[2], fr[3], tip[3], tip[2]], { out: [0.4, 0, 1] }); body([fr[0], fr[1], tip[1], tip[0]], { out: [0, 0, -1] });
      body([fr[1], fr[2], tip[2], tip[1]], { out: [0, 1, 0] }); body([fr[3], fr[0], tip[0], tip[3]], { out: [0, -1, 0] }); body(tip, { out: [1, 0, 0] });
      // the tail, blunter
      const tt2 = [[-Lt, -1.4, 7.4], [-Lt, 1.4, 7.4], [-Lt, 1.4, 9.2], [-Lt, -1.4, 9.2]], bk = [[xtl, -wb, zb], [xtl, wb, zb], [xtl, wb, zt], [xtl, -wb, zt]];
      body([bk[2], bk[3], tt2[3], tt2[2]], { out: [-0.4, 0, 1] }); body([bk[0], bk[1], tt2[1], tt2[0]], { out: [0, 0, -1] });
      body([bk[1], bk[2], tt2[2], tt2[1]], { out: [0, 1, 0] }); body([bk[3], bk[0], tt2[0], tt2[3]], { out: [0, -1, 0] }); body(tt2, { out: [-1, 0, 0] });
      for (const sd of [-1, 1]) {
        sc.poly([[xtl + 1, sd * (wb + 0.01), 8.55], [xn - 0.4, sd * (wb + 0.01), 8.55], [xn - 0.4, sd * (wb + 0.01), 9.4], [xtl + 1, sd * (wb + 0.01), 9.4]], { rgb: [22, 34, 46], spec: 0.6, shin: 40, out: [0, sd, 0] });
        sc.poly([[xtl, sd * (wb + 0.01), 7.65], [xn, sd * (wb + 0.01), 7.65], [xn, sd * (wb + 0.01), 7.85], [xtl, sd * (wb + 0.01), 7.85]], { rgb: [214, 150, 50], out: [0, sd, 0] });
        for (let i = 1; i < p.sections; i++) { const x = -i * R.ML.secLen; sc.line([x, sd * (wb + 0.02), zb], [x, sd * (wb + 0.02), zt], 'rgba(60,70,76,0.8)', 1); }
      }
      sc.glow([0.3, 0, 7.8], 1.2, [255, 240, 200], 0.8);
      // what is what
      sc.label([-1, -2.0, 6.05], 'coils in the track (drawn 10× bigger)', { color: '#ffd590' });
      sc.label([-34, -2.3, 5.75], 'magnets on the train', { color: '#9fd8ff' });
      sc.end();
      drawGauge(c, W, H); drawProgress(c, W, H);
      text(c, 'skirt drawn see-through', W - 10, H - 52, { align: 'right', size: 11, color: 'rgba(214,224,218,0.6)' });
    }
    /* ---- drawing: side view, the camera rides with the nose of the train ---- */
    function drawMaglev(c, W, H) {
      const s = clamp(W / 74, 3.8, 16), yG = Math.round(H * 0.8), beamTop = yG - Math.max(6.6 * s, 44);
      const Y = m => beamTop - m * s, xF = Math.round(W * 0.72), v = st.v;
      // sky: blue hour over Shanghai, a warm afterglow low in the west, a few stars and a low moon
      const sg = c.createLinearGradient(0, 0, 0, yG);
      sg.addColorStop(0, '#0a1430'); sg.addColorStop(0.45, '#1d2d5c'); sg.addColorStop(0.75, '#5a4778'); sg.addColorStop(0.92, '#c46e6a'); sg.addColorStop(1, '#f0a070');
      c.fillStyle = sg; c.fillRect(0, 0, W, yG);
      for (let i = 0; i < 46; i++) { const x = hash(i) * W, y = hash(i + 50) * yG * 0.4; c.fillStyle = `rgba(230,240,255,${(0.15 + 0.4 * hash(i + 9)) * (1 - y / (yG * 0.4))})`; c.fillRect(x, y, 1.3, 1.3); }
      glow(c, W * 0.86, yG - 10, H * 0.6, '255,160,100', 0.22);
      { const mx = W * 0.2, my = yG * 0.22, mr = Math.max(9, H * 0.028); glow(c, mx, my, mr * 5, '220,230,255', 0.12); c.fillStyle = '#f3f0e2'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.fillStyle = 'rgba(29,45,92,0.9)'; c.beginPath(); c.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.92, 0, TAU); c.fill(); }
      // far city (parallax 3 %)
      const off1 = scene * s * 0.03;
      for (let i = Math.floor(off1 / 34) - 1; i < Math.floor(off1 / 34) + W / 34 + 2; i++) {
        const x = i * 34 - off1, h = (0.12 + 0.55 * Math.pow(hash(i), 2)) * yG * 0.75, w = 16 + 14 * hash(i + 3);
        c.fillStyle = '#1a2236'; c.fillRect(x, yG - h, w, h);
        if (hash(i + 7) > 0.8) { c.fillRect(x + w / 2 - 1, yG - h - 12, 2, 12); if (Math.sin(performance.now() / 500 + i) > 0.2) { c.fillStyle = 'rgba(255,70,60,0.9)'; c.fillRect(x + w / 2 - 1.5, yG - h - 14, 3, 3); } }
        c.fillStyle = 'rgba(255,214,140,0.45)';
        for (let k = 0; k < 6; k++) if (hash(i * 13 + k) > 0.55) c.fillRect(x + 3 + (k % 2) * (w - 8), yG - h + 6 + k * h / 7, 2, 2);
      }
      // trees and lamps (parallax 25 %)
      const off2 = scene * s * 0.25;
      for (let i = Math.floor(off2 / 60) - 1; i < Math.floor(off2 / 60) + W / 60 + 2; i++) {
        const x = i * 60 - off2 + hash(i + 21) * 30, r = 8 + 9 * hash(i + 31);
        c.fillStyle = '#0f1a17'; c.beginPath(); c.arc(x, yG - r * 0.9, r, 0, TAU); c.fill(); c.fillRect(x - 1.5, yG - r * 0.5, 3, r * 0.5);
      }
      // ground
      const gg = c.createLinearGradient(0, yG, 0, H); gg.addColorStop(0, '#1b2521'); gg.addColorStop(1, '#0a0f0d');
      c.fillStyle = gg; c.fillRect(0, yG, W, H - yG);
      c.strokeStyle = 'rgba(200,230,210,0.07)'; c.lineWidth = 1; const off3 = (scene * s) % 40;
      for (let x = -off3; x < W; x += 40) { c.beginPath(); c.moveTo(x, yG + 3); c.lineTo(x - 30, H); c.stroke(); }
      // pillars every 25 m and the beam
      const k0 = Math.ceil((scene - xF / s - 4) / 25), k1 = Math.floor((scene + (W - xF) / s + 4) / 25);
      for (let k = k0; k <= k1; k++) {
        const x = xF - (scene - 25 * k) * s, pw = Math.max(1.3 * s, 6);
        const pg = c.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0); pg.addColorStop(0, '#3e4648'); pg.addColorStop(0.5, '#5b6466'); pg.addColorStop(1, '#2f3537');
        c.fillStyle = pg; c.fillRect(x - pw / 2, Y(-2.3), pw, yG - Y(-2.3));
        c.fillStyle = '#4b5355'; c.fillRect(x - pw * 0.9, Y(-2.3), pw * 1.8, Math.max(3, 0.5 * s));
      }
      const bg = c.createLinearGradient(0, Y(0), 0, Y(-2.3)); bg.addColorStop(0, '#9aa2a2'); bg.addColorStop(0.3, '#7b8483'); bg.addColorStop(1, '#4b5352');
      c.fillStyle = bg; c.fillRect(0, Y(0), W, Y(-2.3) - Y(0));
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, Y(-0.75), W, Y(-2.3) - Y(-0.75));
      c.strokeStyle = 'rgba(20,24,24,0.7)'; c.lineWidth = 1;
      for (let k = k0; k <= k1; k++) { const x = Math.round(xF - (scene - 25 * k - 12.5) * s) + 0.5; c.beginPath(); c.moveTo(x, Y(0)); c.lineTo(x, Y(-2.3)); c.stroke(); }
      // the train, then (seen through its skirt) the Gauss part: the coils in the track and the magnets on the train
      const tl = d.trainLen * s, xT = xF - tl;
      drawTrain(c, xF, Y, s, tl);
      drawCoils(c, W, Y, s, xF, tl);
      // speed streaks
      if (v > 25 && !reduceMotion) {
        const a = clamp((v - 25) / 100, 0, 0.5);
        c.strokeStyle = `rgba(220,235,255,${a})`; c.lineWidth = 1;
        for (let i = 0; i < 18; i++) { const y = beamTop - (0.3 + 4 * hash(i + 90)) * s - 6, ln = 30 + 80 * hash(i + 40), x = W - ((scene * s * 0.9 + i * 157) % (W + 200)); c.beginPath(); c.moveTo(x, y); c.lineTo(x + ln, y); c.stroke(); }
      }
      drawGauge(c, W, H);
      drawLens(c, W, H);
      drawProgress(c, W, H);
    }
    function drawTrain(c, xF, Y, s, tl) {
      const xT = xF - tl, nose = Math.min(7 * s, tl * 0.2), tail = Math.min(5 * s, tl * 0.15);
      // skirt round the beam, with the support magnets just under the stator
      c.fillStyle = '#2b3236'; c.fillRect(xT + tail * 0.4, Y(0.2), tl - nose * 0.55 - tail * 0.4, Y(-1.05) - Y(0.2));
      c.fillStyle = 'rgba(120,200,255,0.55)'; c.fillRect(xT + tail * 0.4, Y(-0.78), tl - nose * 0.55 - tail * 0.4, Math.max(1.5, 0.05 * s));
      if (st.phase !== 'ready') glow(c, xT + tl / 2, Y(-0.78), tl * 0.35, '120,200,255', 0.07);
      // body
      const bodyG = c.createLinearGradient(0, Y(3.3), 0, Y(0.2)); bodyG.addColorStop(0, '#f4f6f2'); bodyG.addColorStop(0.55, '#dfe4df'); bodyG.addColorStop(1, '#a9b1ad');
      c.fillStyle = bodyG; c.beginPath();
      c.moveTo(xT + tail, Y(3.3)); c.lineTo(xF - nose, Y(3.3));
      c.bezierCurveTo(xF - nose * 0.35, Y(3.25), xF, Y(1.6), xF, Y(0.9));
      c.quadraticCurveTo(xF - 2, Y(0.2), xF - nose * 0.4, Y(0.2));
      c.lineTo(xT + tail * 0.3, Y(0.2)); c.quadraticCurveTo(xT, Y(0.6), xT, Y(1.5));
      c.bezierCurveTo(xT, Y(2.6), xT + tail * 0.3, Y(3.3), xT + tail, Y(3.3)); c.closePath(); c.fill();
      // brass stripe and the window band
      c.fillStyle = lamp(); c.fillRect(xT + tail * 0.4, Y(1.05), tl - tail * 0.4 - nose * 0.25, Math.max(2, 0.16 * s));
      c.fillStyle = '#1c2a36'; c.fillRect(xT + tail, Y(2.55), tl - nose * 0.75 - tail, Y(1.75) - Y(2.55));
      c.fillStyle = 'rgba(160,210,255,0.18)'; c.fillRect(xT + tail, Y(2.55), tl - nose * 0.75 - tail, Math.max(1, 0.08 * s));
      // the cab window
      c.fillStyle = '#16232e'; c.beginPath(); c.moveTo(xF - nose * 0.72, Y(2.95)); c.quadraticCurveTo(xF - nose * 0.22, Y(2.8), xF - nose * 0.12, Y(1.95)); c.lineTo(xF - nose * 0.72, Y(1.95)); c.closePath(); c.fill();
      // section joints and doors
      c.strokeStyle = 'rgba(40,50,56,0.75)'; c.lineWidth = 1;
      for (let i = 1; i < p.sections; i++) { const x = Math.round(xF - i * R.ML.secLen * s) + 0.5; c.beginPath(); c.moveTo(x, Y(3.3)); c.lineTo(x, Y(0.2)); c.stroke(); }
      c.strokeStyle = 'rgba(60,70,76,0.5)';
      for (let i = 0; i < p.sections; i++) { const x = xF - (i + 0.5) * R.ML.secLen * s; c.strokeRect(Math.round(x - 0.6 * s) + 0.5, Math.round(Y(2.9)) + 0.5, Math.round(1.2 * s), Math.round(Y(0.35) - Y(2.9))); }
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(xT + tail, Y(3.25), tl - nose - tail, Math.max(1, 0.06 * s));
      // head light
      glow(c, xF - 2, Y(0.9), 18, '255,240,200', 0.55);
    }
    // the long stator as a row of coils, drawn 10× bigger than the real 0.26 m pole pitch. It is powered in sections
    // (about 1.2 km each) that switch on as the train comes, like a Gauss gun switching its next coil. Inside a powered
    // section the three-phase current makes north (red) and south (blue) poles that travel with the train at 2τf;
    // when the motor pulls, the poles sit a little ahead of the train's magnets (behind them when it brakes).
    function powered(X) {
      if (st.phase === 'ready' || st.done) return false;
      const k = Math.floor(X / SEC), tail = scene - d.trainLen;
      return k >= Math.floor(tail / SEC) && k <= Math.floor((scene + 250) / SEC);
    }
    function drawCoils(c, W, Y, s, xF, tl) {
      const pitch = TAU_V * s, k0 = Math.floor((scene - xF / s) / TAU_V) - 1, k1 = Math.ceil((scene + (W - xF) / s) / TAU_V) + 1;
      const yC = Y(-0.62), hC = Math.max(4, 0.34 * s), yM = Y(-0.9), hM = Math.max(3, 0.24 * s);
      const lead = st.F && d.Fmax ? 0.25 * TAU_V * clamp(st.F / d.Fmax, -1, 1) : 0;
      const xT = xF - tl;
      c.save();
      for (let k = k0; k <= k1; k++) {
        const X = (k + 0.5) * TAU_V, x = xF - (scene - X) * s;
        if (x < -pitch || x > W + pitch) continue;
        const on = powered(X), I = Math.cos(Math.PI * (X - scene - lead) / TAU_V);
        c.fillStyle = '#4a321e'; c.fillRect(x - pitch * 0.4, yC, pitch * 0.8, hC);
        if (on) {
          const a = 0.25 + 0.75 * Math.abs(I);
          c.fillStyle = I > 0 ? `rgba(255,96,70,${a})` : `rgba(90,160,255,${a})`;
          c.fillRect(x - pitch * 0.4, yC, pitch * 0.8, hC);
          if (Math.abs(I) > 0.8 && x > xT - pitch && x < xF + pitch) glow(c, x, yC + hC / 2, pitch * 0.7, I > 0 ? '255,110,80' : '110,170,255', 0.35);
        }
      }
      // section ends: the next section switches on before the train gets there
      for (let n = Math.floor((scene - xF / s) / SEC); n <= Math.ceil((scene + (W - xF) / s) / SEC); n++) {
        const x = xF - (scene - n * SEC) * s;
        if (x < 0 || x > W) continue;
        c.fillStyle = '#0b0e0f'; c.fillRect(x - 1.5, yC - 3, 3, hC + 6);
        text(c, powered(n * SEC + 1) ? `section ${n + 1}: on` : `section ${n + 1}: off`, x + 5, yC - 10, { size: 11, color: powered(n * SEC + 1) ? '#ffd590' : 'rgba(214,224,218,0.6)' });
      }
      // the train's magnets, fixed to the train: opposite poles sit under the coils' poles and are pulled along
      for (let k = Math.floor((scene - d.trainLen) / TAU_V); k <= Math.ceil(scene / TAU_V); k++) {
        const X = (k + 0.5) * TAU_V, x = xF - (scene - X) * s;
        if (x < xT + pitch * 0.4 || x > xF - pitch * 0.4) continue;
        const M = Math.cos(Math.PI * (X - scene) / TAU_V);
        c.fillStyle = M > 0 ? 'rgba(90,160,255,0.85)' : 'rgba(255,96,70,0.85)';
        c.fillRect(x - pitch * 0.32, yM, pitch * 0.64, hM);
      }
      c.restore();
      const lx = Math.max(12, Math.min(xT + 8, W * 0.06));
      text(c, 'coils in the track (drawn 10× bigger)', lx, yC - 9, { size: 11.5, color: '#ffd590' });
      if (xT < W - 40) text(c, 'magnets on the train', Math.max(xT + 8, 12), yM + hM + 12, { size: 11.5, color: '#9fd8ff' });
    }
    function drawGauge(c, W, H) {
      const x = 16, y = W < 560 ? 48 : 14, w = Math.min(230, W * 0.46), h = 70;
      rrect(c, x, y, w, h, 8); c.fillStyle = 'rgba(6,10,12,0.72)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.08)'; c.stroke();
      const kmh = st.v * 3.6;
      c.font = F(38, 500); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.shadowColor = 'rgba(255,170,60,0.7)'; c.shadowBlur = 12; c.fillStyle = '#ffd590'; c.fillText(pl(kmh, 3), x + 12, y + 44); c.shadowBlur = 0;
      const wN = c.measureText(pl(kmh, 3)).width;
      text(c, 'km/h', x + 18 + wN, y + 38, { size: 14, color: 'rgba(255,220,170,0.8)' });
      // speed bar with marks at 300, 431 and 505
      const bx = x + 12, bw = w - 24, by = y + 54;
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(bx, by, bw, 5);
      const g = c.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ffb020'); g.addColorStop(1, '#ff6a3d');
      c.fillStyle = g; c.fillRect(bx, by, bw * clamp(kmh / 505, 0, 1), 5);
      for (const m of [300, 431, 505]) { const xm = bx + bw * m / 505; c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(xm - 0.5, by - 2, 1, 9); }
      text(c, `field ${pl(R.mlFreq(st.v), 3)} Hz`, x + w - 10, y + 18, { size: 13, align: 'right', color: '#9df5b8' });
    }
    function drawLens(c, W, H) {
      const r = clamp(Math.min(W, H) * 0.15, 42, 74), cx = W - r - 62, cy = r + (W < 560 ? 52 : 18);   // clear of the 2D/3D buttons
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
      c.fillStyle = '#05080a'; c.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      const sc = 2 * r / (2.2 * 2 * R.ML.tau), gapY = cy - r * 0.02, xT = lensX;   // px per metre; the train frame (magnets fixed)
      // stator iron with slots (six per wavelength), coils carrying the travelling current pattern
      c.fillStyle = '#3c4246'; c.fillRect(cx - r, cy - r, 2 * r, gapY - 4 - (cy - r));
      const slot = R.ML.tau / 3, k0 = Math.floor((xT - r / sc) / slot) - 1, k1 = Math.ceil((xT + r / sc) / slot) + 1;
      for (let k = k0; k <= k1; k++) {
        const xw = k * slot, x = cx + (xw - xT) * sc, I = Math.cos(Math.PI * (xw - xT) / R.ML.tau);
        c.fillStyle = '#1a1e20'; c.fillRect(x - slot * sc * 0.22, gapY - 4 - r * 0.42, slot * sc * 0.44, r * 0.42);
        c.fillStyle = I > 0 ? `rgba(255,${120 - 60 * I},${80 - 40 * I},${0.25 + 0.7 * Math.abs(I)})` : `rgba(${90 + 40 * I},${150 + 30 * I},255,${0.25 + 0.7 * Math.abs(I)})`;
        c.fillRect(x - slot * sc * 0.16, gapY - 4 - r * 0.38, slot * sc * 0.32, r * 0.32);
      }
      // the magnet on the train: poles fixed in the train's frame
      c.fillStyle = '#20262a'; c.fillRect(cx - r, gapY + 4, 2 * r, r);
      for (let i = -3; i <= 3; i++) {
        const x = cx + (i + 0.5) * R.ML.tau * sc, n = i % 2 === 0;
        c.fillStyle = n ? 'rgba(229,72,63,0.85)' : 'rgba(62,126,230,0.85)'; c.fillRect(x - R.ML.tau * sc * 0.42, gapY + 6, R.ML.tau * sc * 0.84, r * 0.24);
        c.fillStyle = '#fff'; c.font = F(11); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n ? 'N' : 'S', x, gapY + 6 + r * 0.12);
      }
      // the 10 mm gap and its field
      c.strokeStyle = 'rgba(157,245,184,0.35)'; c.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { const x = cx + (i + 0.5) * R.ML.tau * sc; c.beginPath(); c.moveTo(x, gapY + 6); c.bezierCurveTo(x, gapY - r * 0.3, x + R.ML.tau * sc, gapY - r * 0.3, x + R.ML.tau * sc, gapY + 6); c.stroke(); }
      c.fillStyle = 'rgba(120,200,255,0.9)'; c.fillRect(cx - r, gapY - 4, 2 * r, 2);
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
      text(c, 'stator in the guideway', cx, cy - r * 0.78, { align: 'center', size: 11 });
      text(c, 'magnet on the train', cx, cy + r * 0.62, { align: 'center', size: 11 });
      text(c, '10 mm gap', cx - r - 6, gapY - 2, { size: 11.5, color: '#9fd8ff', align: 'right' });
      if (W < 560) text(c, 'close-up, slowed 400×', W - 8, cy + r + 12, { align: 'right', size: 11, color: 'rgba(214,224,218,0.7)' });
      else text(c, 'close-up under the train, slowed 400×', cx, cy + r + 12, { align: 'center', size: 11, color: 'rgba(214,224,218,0.7)' });
    }
    function drawProgress(c, W, H) {
      const x0 = 18, x1 = W - 18, y = H - 16, e = ends();
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
      const f = clamp(st.x / (p.km * 1e3), 0, 1), xm = x0 + (x1 - x0) * f;
      c.strokeStyle = lamp(); c.beginPath(); c.moveTo(x0, y); c.lineTo(xm, y); c.stroke();
      for (const [k, lab] of [['k300', '300'], ['k431', '431']]) { const mk = st.marks[k]; if (mk) { const xx = x0 + (x1 - x0) * mk.x / (p.km * 1e3); c.fillStyle = 'rgba(255,214,140,0.8)'; c.fillRect(xx - 0.5, y - 6, 1, 12); text(c, lab, xx, y - 11, { size: 10.5, align: 'center', color: 'rgba(255,214,140,0.85)' }); } }
      for (const [x, lab, al] of [[x0, e[0], 'left'], [x1, e[1], 'right']]) { c.fillStyle = '#e6ece8'; c.beginPath(); c.arc(x, y, 4, 0, TAU); c.fill(); text(c, lab, x + (al === 'left' ? 8 : -8), y - 10, { size: 11.5, align: al }); }
      glow(c, xm, y, 10, '255,190,90', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(xm, y, 3, 0, TAU); c.fill();
      // the same trip by road, started at the same moment: about 30 km/h through the city
      if (st.t > 0) {
        const fr = clamp(st.t * ROAD_V / (p.km * 1e3), 0, 1), xr = x0 + (x1 - x0) * fr, yr = y - 22;
        c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, yr); c.lineTo(x1, yr); c.stroke();
        c.strokeStyle = 'rgba(255,120,100,0.85)'; c.beginPath(); c.moveTo(x0, yr); c.lineTo(xr, yr); c.stroke();
        c.fillStyle = '#ff8a78'; rrect(c, xr - 7, yr - 4, 14, 8, 2); c.fill(); c.fillStyle = '#1b2022'; c.fillRect(xr - 5, yr + 3, 3, 2); c.fillRect(xr + 2, yr + 3, 3, 2);
        const lab = st.done ? `by road, the car is only ${pl(st.t * ROAD_V / 1e3, 2)} km along` : `same trip by road: ${pl(st.t * ROAD_V / 1e3, 2)} km`;
        text(c, lab, clamp(xr + 12, x0 + 4, x1 - 180), yr - 9, { size: 11, color: 'rgba(255,170,150,0.95)' });
      }
    }
    return sim;
  }

  /* =====================================================================
     2. JET CATAPULT — EMALS or steam, and the first seconds of flight
     ===================================================================== */
  function makeCatapult() {
    // push: the catapult's average pull in MN. EMALS: the coils pull this hard all the way (a computer sets their current);
    // steam: the same average, but hardest at the start. 0.42 MN takes this jet to about 130 kn.
    const p = { sys: 'emals', ac: 'fa18', m: 25000, push: 0.42, wod: 25, clMax: 1.8, deckH: 20, noCat: false };
    let Lr, Lo, anim = 0, puffs = [], spray = [], camX = null, camH = 0, splashed = false, bowed = false, minCache = null, minKey = '';
    let ctlM, ctlV, segSys, acSync;
    const ac = () => R.AIRCRAFT[p.ac];
    const base = () => ({ ac: ac(), m: p.m, push: p.noCat ? 0 : p.push * 1e6, wod: p.wod * KN, clMax: p.clMax, deckH: p.deckH });
    const withCat = () => R.launch(Object.assign(base(), { sys: p.sys, push: p.push * 1e6 }));
    const noCat = () => R.launch(Object.assign(base(), { sys: p.sys, push: 0 }));
    const xBow = () => Lr.L + 1.5;
    const tFlight = () => Lr.flight ? Lr.flight.tr[Lr.flight.tr.length - 1].t : 0;
    function compute() { Lr = R.launch(Object.assign(base(), { sys: p.sys })); Lo = R.launch(Object.assign(base(), { sys: p.sys === 'emals' ? 'steam' : 'emals' })); }
    function minSetting() {
      const key = [p.ac, p.m, p.wod, p.sys, p.clMax, p.deckH].join();
      if (key !== minKey) { minKey = key; const b = Object.assign(base(), { sys: p.sys }); delete b.push; minCache = { climb: R.minSafePush(b, 'climb'), dry: R.minSafePush(b, 'dry') }; }
      return minCache;
    }
    function reset() { compute(); anim = 0; puffs = []; spray = []; camX = null; camH = 0; splashed = false; bowed = false; }
    // where the jet is at animation time t: on the deck (stroke trace) or in the air (flight trace)
    function jetAt(t) {
      if (t <= Lr.tEnd || !Lr.flight) { const q = interp(Lr.tr, Math.min(t, Lr.tEnd)) || { x: 0, v: 0, a: 0, F: 0 }; return { x: q.x, h: p.deckH, v: q.v, V: q.v + p.wod * KN, a: t > 0 && t <= Lr.tEnd ? q.a : 0, F: t > 0 && t <= Lr.tEnd ? q.F : 0, air: false, pitch: 0 }; }
      const q = interp(Lr.flight.tr, t - Lr.tEnd);
      return { x: Lr.L + q.x, h: q.h, V: q.V, v: q.V - p.wod * KN, a: 0, F: 0, air: true, pitch: q.gam + 0.07 * q.CL, gam: q.gam };
    }
    function sideNotes() {
      const a = ac(), n = $('#rsCatAcNote');
      if (n) n.innerHTML = `${a.kind}: wing ${pl(a.S, 4)} m², ${pl(a.empty, 4)} kg empty, ${pl(a.mtow, 4)} kg at most, engines ${si(a.thrust, 'N', 3)}${a.ab ? ' with afterburner' : ''}.`;
      const sn = $('#rsCatSysNote'); if (sn) sn.textContent = p.sys === 'emals' ? 'A linear induction motor 91 m long. A computer sets its push for each aircraft, and keeps it steady all the way.' : 'Steam from the ship’s power plant drives pistons along slotted cylinders under the deck, about 94 m long. The push is strongest at the start and fades as the steam expands.';
      const mn = $('#rsCatMinNote');
      if (mn && mn.dataset.on) { const mc = minSetting(); mn.innerHTML = mc.climb == null ? 'No pull up to 1.2 MN is enough here.' : `Weakest pull that climbs away without sinking more than 1 m: <b>${pl(mc.climb / 1e6, 3)} MN</b>${mc.dry != null ? `; below ${pl(mc.dry / 1e6, 3)} MN it ends in the sea` : ''}. Real launches add a safety margin on top.`; }
      const pn = $('#rsCatPushNote'); if (pn) pn.innerHTML = p.sys === 'emals' ? `→ the jet leaves the deck at <b>${pl(Lr.vEnd / KN, 3)} kn</b> (${pl(Lr.vEnd * 3.6, 3)} km/h). The coils pull with the same force all the way; 1 MN is the weight of about 100 tonnes.` : `→ the jet leaves the deck at <b>${pl(Lr.vEnd / KN, 3)} kn</b>. No coils here: steam pistons push, ${pl(Lr.peakF / 1e6, 3)} MN at first, then weaker.`;
    }
    const sim = {
      go: 'Launch', speeds: [['1', 'Real speed'], ['0.3', 'Slow motion'], ['0.05', 'Bullet time']], speed0: '0.3',
      canvasLabel: 'Side view of the bow of an aircraft carrier: the catapult track, the jet and its flight path over the sea',
      graphs: ['Push on the pilot along the deck', 'Height above the sea after the bow'],
      side() {
        return `<div class="panel"><div class="panel-title">Catapult</div>${segHTML('cat-sys', 'Type of catapult', [['emals', 'EMALS', 'electromagnetic'], ['steam', 'Steam', 'piston']])}<p class="hint" id="rsCatSysNote"></p></div>
          <div class="panel"><div class="panel-title">Aircraft</div><div class="pgrid pgrid-3" id="rs-cat-ac" role="radiogroup" aria-label="Aircraft">${Object.values(R.AIRCRAFT).map(a => `<button type="button" class="pbtn-part" role="radio" data-key="${a.key}"><span class="sym">${a.name.split(' ')[0]}</span><span class="nm">${a.name.split(' ').slice(1).join(' ')}</span></button>`).join('')}</div><p class="pnote" id="rsCatAcNote"></p></div>
          <details class="acc tag-copper" open><summary><span class="acc-title">Launch settings</span></summary><div class="acc-body">
            ${ctl('cat-v', 'Pull of the catapult', 'MN')}<p class="hint" id="rsCatPushNote"></p>
            <div data-level="expert">${ctl('cat-m', 'Take-off mass', 'kg', 'numeric')}${ctl('cat-w', 'Wind over the deck', 'kn')}</div>
            <p class="hint">The carrier steams into the wind, so air already flows over the deck before the catapult fires. 1 kn = 1.852 km/h.</p>
            <button type="button" class="pbtn" id="rsCatMin">Find the weakest pull that flies</button><p class="hint" id="rsCatMinNote"></p></div></details>
          <details class="acc tag-tools" data-level="expert"><summary><span class="acc-title">Assumptions</span></summary><div class="acc-body">
            ${ctl('cat-cl', 'Maximum lift coefficient', '')}${ctl('cat-h', 'Deck above the sea', 'm')}
            <p class="hint">Not published for these jets: C<sub>L,max</sub> 1.8 with flaps down, drag coefficient 0.05 + C<sub>L</sub>²/(π·0.8·aspect ratio), deck about 20 m up.</p></div></details>`;
      },
      bind(changed) {
        segSys = segInit($('#rs-cat-sys'), () => p.sys, v => { p.sys = v; changed(); });
        const box = $('#rs-cat-ac');
        acSync = () => { for (const b of $$('button', box)) b.setAttribute('aria-checked', String(b.dataset.key === p.ac)); };
        box.addEventListener('click', ev => { const b = ev.target.closest('button[data-key]'); if (!b) return; p.ac = b.dataset.key; const a = ac(); p.m = Math.round(clamp(a.empty + 0.62 * (a.mtow - a.empty), a.empty, a.mtow) / 100) * 100; ctlM.setLimits(Math.ceil(a.empty / 100) * 100, Math.floor(a.mtow / 100) * 100); acSync(); changed(); });
        acSync();
        const a = ac();
        ctlM = range('cat-m', { min: Math.ceil(a.empty / 100) * 100, max: Math.floor(a.mtow / 100) * 100, step: 100, int: true, get: () => p.m, set: v => { p.m = v; changed(); } });
        ctlV = range('cat-v', { min: 0.05, max: 1.2, step: 0.01, get: () => p.push, set: v => { p.push = v; p.noCat = false; changed(); } });
        range('cat-w', { min: 0, max: 45, step: 1, int: true, get: () => p.wod, set: v => { p.wod = v; changed(); } });
        range('cat-cl', { min: 1.2, max: 2.6, step: 0.05, get: () => p.clMax, set: v => { p.clMax = v; changed(); } });
        range('cat-h', { min: 12, max: 30, step: 1, int: true, get: () => p.deckH, set: v => { p.deckH = v; changed(); } });
        $('#rsCatMin').addEventListener('click', () => {
          const mn = $('#rsCatMinNote'); mn.dataset.on = '1';
          const mc = minSetting();
          if (mc.climb != null) { p.push = clamp(Math.ceil(mc.climb / 1e4) / 100, 0.05, 1.2); p.noCat = false; ctlV.sync(); }
          changed();
        });
      },
      reset() { reset(); sideNotes(); },
      step(dts, dtr) {
        const before = anim;
        if (anim < Lr.tEnd) anim += dts; else anim += dtr * (dtr > 0 && dts / dtr < 0.1 ? 0.3 : 1);   // slow motion on the deck, (nearly) real time in the air
        if (before === 0 && anim > 0) audio.charge && (p.sys === 'emals' ? audio.charge(0.6) : audio.whoosh());
        if (!bowed && anim > Lr.tEnd && Lr.done) { bowed = true; audio.whoosh(); }
        const end = Lr.done ? Lr.tEnd + tFlight() + 1.2 : 1.5;
        return anim >= end;
      },
      draw(c, W, H, dtr, running) { drawCat(c, W, H, dtr, running); },
      clock: () => anim <= 0 ? 'ready' : anim <= Lr.tEnd ? `t = ${pl(anim, 3)} s on the deck` : `t = ${pl(anim, 3)} s`,
      status() {
        if (anim <= 0) return p.noCat ? [`${ac().name}: engines only, no catapult`, 'is-warn'] : [`${ac().name} on the ${p.sys === 'emals' ? 'EMALS' : 'steam'} catapult`, ''];
        if (p.noCat && anim <= Lr.tEnd) return [`Engines only · ${pl(jetAt(anim).v / KN, 3)} kn`, 'is-warn'];
        if (!Lr.done) return ['The catapult could not move the jet', 'is-bad'];
        if (anim <= Lr.tEnd) return [`Launching · ${pl(jetAt(anim).v / KN, 3)} kn`, 'is-run'];
        const o = Lr.outcome, fl = Lr.flight;
        if (o === 'splash') return [anim - Lr.tEnd >= tFlight() ? 'Too slow: into the sea' : 'Sinking off the bow', 'is-bad'];
        if (o === 'sink') return [`Settled ${pl(fl.sink, 2)} m below the deck, then climbed`, 'is-warn'];
        if (fl.sink > 0.05) return [`Dipped ${pl(fl.sink, 2)} m, then climbed`, 'is-warn'];
        return ['Airborne and climbing', 'is-good'];
      },
      narrate() {
        const a = ac(), Vs = Lr.Vs, need = Math.max(0, Vs - p.wod * KN), eff = Math.round(Lr.sys.eff * 100);
        if (p.noCat) {
          const rw = R.runway({ ac: a, m: p.m, clMax: p.clMax });
          if (anim <= 0) return `<b>No catapult</b>: only the jet’s own engines (${si(a.thrust, 'N', 3)}) push it along the ${pl(Lr.L, 3)} m of deck. It needs about <b>${pl(Vs / KN, 3)} kn</b> of airspeed before its wings can hold it up. Press <b>Launch</b> and watch.`;
          if (anim <= Lr.tEnd) return `Engines alone give a = (T − D)/m = ${pl(jetAt(anim).a || 0, 2)} m/s², far less than the catapult adds. On land this jet would need at least <b>${pl(rw.x, 3)} m</b> of runway to reach ${pl(Vs / KN, 3)} kn; here it has ${pl(Lr.L, 3)} m.`;
          const o = Lr.outcome;
          return `Off the bow at only <b>${pl(Lr.Vbow / KN, 3)} kn</b> of airspeed, below the ${pl(Vs / KN, 3)} kn the wing needs. ${o === 'splash' ? 'Lift is less than weight, so the jet <b>falls into the sea</b>.' : o === 'sink' ? `It drops <b>${pl(Lr.flight.sink, 2)} m</b> towards the sea before the engines catch it: no pilot would accept that.` : 'It just climbs away here, but with no margin at all.'} This is why a carrier needs its catapult.`;
        }
        if (simple()) {
          if (anim <= 0) return `The ${a.name} must reach about <b>${pl(Vs / KN, 3)} kn</b> through the air before its wings can hold it up. The ship steams into the wind (${p.wod} kn), and the catapult adds the rest in ${pl(Lr.L, 3)} m. ${p.sys === 'emals' ? `Its coils switch on one after another and pull the shuttle, and the jet, along the deck: a giant Gauss gun. You set their pull to <b>${pl(p.push, 3)} MN</b>: more pull, faster jet.` : `This one is driven by steam instead of coils, pushing <b>${pl(p.push, 3)} MN</b> on average.`} Press <b>Launch</b>.`;
          if (!Lr.done) return 'The catapult is too weak to move the jet. Give it more pull or pick a lighter jet.';
          if (anim <= Lr.tEnd) return p.sys === 'emals' ? `The coils pull with a steady force, so the pilot feels a steady <b>${pl(Lr.peakG, 2)} g</b>. a = F/m.` : `Steam pushes hardest at the start (<b>${pl(Lr.peakG, 2)} g</b> on the pilot), then weaker as it expands.`;
          if (Lr.outcome === 'splash') return `Too slow: the wings could not hold the jet up and it fell into the sea. Give the coils more pull, or try <b>Find the weakest pull that flies</b>.`;
          if (Lr.outcome === 'sink') return `Only just: the jet sank ${pl(Lr.flight.sink, 2)} m towards the sea before its engines got it climbing. Far too close!`;
          if (Lr.Vbow < Lr.Vs) return `Just enough: ${pl(Lr.Vbow / KN, 3)} kn through the air is a little below the ${pl(Lr.Vs / KN, 3)} kn the wings need, so the jet dipped ${pl(Lr.flight.sink, 2)} m while its engines added speed, then climbed away. Real launches keep a margin.`;
          return `Fast enough: off the bow at ${pl(Lr.Vbow / KN, 3)} kn through the air, so the wings hold the jet up and it climbs away.`;
        }
        if (anim <= 0) return `The ${a.name} (${pl(p.m, 4)} kg) needs about <b>${pl(Vs / KN, 3)} kn of airspeed</b> before its wings can hold its weight (lift = weight at the maximum lift coefficient). The ship gives ${p.wod} kn of wind over the deck, so to leave the bow at that airspeed the catapult must add ${pl(need / KN, 3)} kn in ${pl(Lr.L, 3)} m. ${p.sys === 'emals' ? `You set the coils to pull with <b>${si(p.push * 1e6, 'N', 3)}</b>: with the engines that gives a = (F + T − D)/m and ${pl(Lr.vEnd / KN, 3)} kn at the end.` : `The steam push averages <b>${si(p.push * 1e6, 'N', 3)}</b>: ${pl(Lr.vEnd / KN, 3)} kn at the end.`} Press <b>Launch</b>.`;
        if (!Lr.done) return 'The catapult’s pull and the engines together cannot overcome the drag: the jet does not reach the end of the track. Raise the pull or lower the mass.';
        if (anim <= Lr.tEnd) return p.sys === 'emals' ? `The linear motor pushes with a steady <b>${si(Lr.peakF, 'N', 3)}</b>; with the engines (${si(a.thrust, 'N', 3)}) the pilot feels a steady ${pl(Lr.peakG, 2)} g. Newton’s second law: a = F/m.` : `The steam push is strongest at the start (${si(Lr.peakF, 'N', 3)}, ${pl(Lr.peakG, 2)} g on the pilot) and fades as the steam expands. About the same end speed as EMALS with the same average pull, but a harder kick for the airframe.`;
        const o = Lr.outcome, fl = Lr.flight, V = Lr.Vbow;
        const head = `Off the bow at ${pl(Lr.vEnd / KN, 3)} kn along the deck, <b>${pl(V / KN, 3)} kn of airspeed</b> (stall ${pl(Vs / KN, 3)} kn). The catapult did ${si(Lr.Ecat, 'J', 3)} of work and took ${si(Lr.Edrawn, 'J', 3)} from the ship (${eff} % efficient). `;
        if (o === 'splash') return head + `Too slow: the wings could not hold the weight and the engines could not add speed fast enough. The jet hit the sea ${pl(fl.tr[fl.tr.length - 1].t, 2)} s after leaving the deck. Raise the pull or the wind.`;
        if (o === 'sink') return head + `The wing was at its limit (C<sub>L</sub> = ${pl(p.clMax, 2)}), so the jet <b>settled ${pl(fl.sink, 2)} m</b> towards the sea while the engines added speed, then climbed away: far too close for comfort.`;
        if (V < Vs || fl.sink > 0.05) return head + `Below the speed at which the wing alone can carry the weight, so for a moment lift was less than weight: the jet dipped <b>${pl(fl.sink, 2)} m</b> while the engines added the missing speed, then climbed away. Real launches keep a margin above this.`;
        return head + 'Plenty of lift: the jet climbs away at once.';
      },
      tiles() {
        const j = jetAt(anim);
        return [
          ['End speed', `${pl(Lr.vEnd / KN, 3)} kn`, `${pl(Lr.vEnd * 3.6, 3)} km/h after ${pl(Lr.tEnd, 3)} s`],
          ['Push on the pilot', anim > 0 && anim <= Lr.tEnd ? `${pl(j.a / G0, 2)} g` : `${pl(Lr.peakG, 2)} g peak`, `average ${pl(Lr.meanG, 2)} g · ${p.sys === 'emals' ? 'steam would peak at' : 'EMALS would peak at'} ${pl(Lo.peakG, 2)} g`],
          ['Energy from the ship', si(Lr.Edrawn, 'J', 3), `${si(Lr.Ecat, 'J', 3)} into the jet · ${Math.round(Lr.sys.eff * 100)} %${Lr.capped ? ' · at its limit' : ''}`],
          ['Airspeed off the bow', `${pl(Lr.Vbow / KN, 3)} kn`, `stall ${pl(Lr.Vs / KN, 3)} kn · ${Lr.Vbow >= Lr.Vs ? '+' : '−'}${pl(Math.abs(Lr.Vbow / Lr.Vs - 1) * 100, 2)} %`],
        ];
      },
      graphA(cv) {
        const A = Lr.tr.map(q => [q.x, q.a / G0]), B = Lo.tr.map(q => [q.x, q.a / G0]);
        const ymax = Math.max(1, ...A.map(q => q[1]), ...B.map(q => q[1])) * 1.2;
        const r = plot(cv, { xmin: 0, xmax: Math.max(Lr.L, Lo.L), ymin: 0, ymax, xlabel: 'distance along the deck (m)', ylabel: 'acceleration (g)', pad: { r: 16 },
          series: [{ pts: B, color: 'rgba(210,220,214,0.55)', width: 1.4, dash: [5, 4] }, { pts: A, color: p.sys === 'emals' ? '#5cc8ff' : '#ffb020', width: 2.6 }] });
        if (!r) return;
        const c = r.ctx; c.font = '600 11px "Barlow", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'bottom';
        c.fillStyle = p.sys === 'emals' ? '#5cc8ff' : '#ffb020'; c.fillText(p.sys === 'emals' ? 'EMALS (this launch)' : 'steam (this launch)', r.W - r.pad.r - 4, r.YP(A[A.length - 1][1]) - 4);
        c.fillStyle = 'rgba(210,220,214,0.75)'; c.fillText(p.sys === 'emals' ? 'steam, same end speed' : 'EMALS, same end speed', r.W - r.pad.r - 4, r.YP(B[B.length - 1][1]) + 14);
        if (anim > 0 && anim <= Lr.tEnd) { const j = jetAt(anim); c.fillStyle = '#fff'; c.beginPath(); c.arc(r.XP(j.x), r.YP(j.a / G0), 4, 0, TAU); c.fill(); }
      },
      graphB(cv) {
        const fl = Lr.flight, tNow = anim - Lr.tEnd;
        const all = fl ? fl.tr : [], shown = anim >= Lr.tEnd ? all.filter(q => q.t <= tNow + 1e-9) : [];
        const xmax = Math.max(200, ...all.map(q => q.x)) * 1.05, ymax = Math.max(p.deckH + 40, ...all.map(q => q.h)) * 1.08;
        const r = plot(cv, { xmin: 0, xmax, ymin: 0, ymax, xlabel: 'distance from the end of the catapult (m)', ylabel: 'height (m)', pad: { r: 16 },
          series: [{ pts: shown.map(q => [q.x, q.h]), color: Lr.outcome === 'splash' ? '#ff6b5b' : Lr.outcome === 'sink' ? '#ffb020' : '#7dffb0', width: 2.4, dot: shown.length > 1 }] });
        if (!r) return;
        const c = r.ctx, yd = Math.round(r.YP(p.deckH)) + 0.5;
        c.strokeStyle = 'rgba(255,214,140,0.5)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(r.pad.l, yd); c.lineTo(r.W - r.pad.r, yd); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(255,214,140,0.8)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText('flight deck', r.pad.l + 6, yd - 2);
        c.fillStyle = 'rgba(70,150,220,0.25)'; c.fillRect(r.pad.l, r.YP(0) - 3, r.pw, 3);
        if (!shown.length) { c.fillStyle = 'rgba(210,220,214,0.6)'; c.textAlign = 'center'; c.fillText('appears after launch', r.pad.l + r.pw / 2, r.pad.t + r.ph / 2); }
      },
      numbers() {
        const a = ac(), m = p.m, Vs = Lr.Vs, L = Lr.L, T = a.thrust, vE = Lr.vEnd, fl = Lr.flight;
        let h = sec('The jet');
        h += row('Weight', si(m * G0, 'N', 3), `${a.name}, ${pl(m, 4)} kg: between ${pl(a.empty, 4)} kg (empty) and ${pl(a.mtow, 4)} kg (maximum).`, `W = mg = ${pl(m, 4)} kg × 9.81 m/s² = ${si(m * G0, 'N', 3)}`);
        h += row('Speed its wings need', `${pl(Vs / KN, 3)} kn`, 'Below this airspeed the wing cannot lift the weight even at its steepest safe angle (the stall speed).', `lift = ½ρV²SC<sub>L,max</sub> = mg → V = √(2mg / ρSC<sub>L,max</sub>) = √(2 × ${pl(m * G0, 4)} N / (1.225 kg/m³ × ${a.S} m² × ${pl(p.clMax, 3)})) = ${pl(Vs, 3)} m/s`);
        h += row('Engines', si(T, 'N', 3), `${a.ab ? 'Full afterburner' : 'Full power'} through the launch: on their own they would give only ${pl(T / m, 2)} m/s².`, `a = T/m = ${si(T, 'N', 3)} / ${pl(m, 4)} kg`);
        h += sec('The catapult');
        h += row('Track length', `${pl(L, 3)} m`, p.sys === 'emals' ? '300 ft of linear induction motor in the deck.' : 'About 310 ft of steam piston stroke.', '');
        h += row('End speed along the deck', `${pl(vE / KN, 3)} kn`, `${pl(vE * 3.6, 3)} km/h, ${pl(vE, 3)} m/s${Lr.capped ? '. The steam catapult hit its energy limit (about 95 MJ), so the jet left slower than you set.' : '.'}`, `v² = 2aL → a = v² / 2L = (${pl(vE, 4)} m/s)² / (2 × ${pl(L, 3)} m) = ${pl(vE * vE / (2 * L), 3)} m/s² on average`);
        h += row('Time on the catapult', `${pl(Lr.tEnd, 3)} s`, '', `t = 2L / v for a steady push = 2 × ${pl(L, 3)} m / ${pl(vE, 4)} m/s = ${pl(2 * L / vE, 3)} s`);
        h += row(p.sys === 'emals' ? 'Steady push' : 'Strongest push', si(Lr.peakF, 'N', 3), p.sys === 'emals' ? 'The motor’s computer adjusts the current so the jet speeds up evenly.' : 'Modelled as steam expanding as pV¹·³ = constant from a reservoir 2.5 times the piston’s volume (an assumed shape: strongest at the start).', `F = ma − T + drag: peak acceleration ${pl(Lr.peakG, 3)} g = ${pl(Lr.peakG * G0, 3)} m/s²`);
        h += row('Work done on the jet', si(Lr.Ecat, 'J', 3), 'Kinetic energy at the end, minus what the engines gave, plus what air drag took.', `½mv² = ½ × ${pl(m, 4)} kg × (${pl(vE, 4)} m/s)² = ${si(0.5 * m * vE * vE, 'J', 3)}; engines ${si(T * L, 'J', 3)}; drag ${si(Lr.Wdrag, 'J', 3)}`);
        h += row('Energy taken from the ship', si(Lr.Edrawn, 'J', 3), p.sys === 'emals' ? 'EMALS was planned to be about 90 % efficient. Its four disk alternators (heavy spinning rotors) store up to 121 MJ each and recharge within 45 s.' : 'Steam catapults turn only about 5 % of the steam’s energy into work on the jet, and use about 610 kg of steam per launch.', `E = W / η = ${si(Lr.Ecat, 'J', 3)} / ${Lr.sys.eff}`, p.sys === 'steam' ? 'warn' : '');
        h += sec('After the bow');
        h += row('Airspeed off the bow', `${pl(Lr.Vbow / KN, 3)} kn`, `End speed plus the ${p.wod} kn of wind over the deck.`, `${pl(vE / KN, 3)} kn + ${p.wod} kn`);
        if (fl) h += row('What happened', Lr.outcome === 'splash' ? 'into the sea' : Lr.outcome === 'sink' ? `settled ${pl(fl.sink, 2)} m` : 'climbed away', 'The pilot asks for a gentle climb, but the wing gives no more than its maximum lift; the engines keep accelerating the jet.', 'm dV/dt = T − D − mg sin γ;  mV dγ/dt = L − mg cos γ', Lr.outcome === 'splash' ? 'bad' : Lr.outcome === 'sink' ? 'warn' : 'good');
        return h;
      },
      check() {
        const des = R.launch({ ac: Object.assign({}, R.AIRCRAFT.fa18, { thrust: 0 }), m: R.CAT.design.m, vSet: R.CAT.design.v, wod: 0, sys: 'emals' });
        const KE = 0.5 * R.CAT.design.m * R.CAT.design.v * R.CAT.design.v;
        let h = `<p class="hint">EMALS’s published design case, run through the same model (engines off, no wind), and the published facts this simulation uses.</p>`;
        h += cmpTable([
          ['EMALS design case', `45,000 kg to ${pl(des.vEnd / KN, 3)} kn in ${pl(des.L, 3)} m`, '45,000 kg to 130 kn on a 91 m track', 'emals', 'good'],
          ['Its kinetic energy', si(KE, 'J', 3), 'compare: about 95 MJ from a steam catapult, 121 MJ stored in each EMALS alternator', 'emals'],
          ['Its acceleration', `${pl(des.peakG, 3)} g for ${pl(des.tEnd, 3)} s`, '–', null],
          ['Efficiency', 'EMALS 90 %, steam 5 %', 'planned 90 %; steam about 5 % (4–6 %)', 'emals'],
          ['Steam per launch', '610 kg', 'about 1,350 lb (610 kg)', 'emals'],
          ['Shape of the push', 'EMALS steady, steam strongest at the start', 'steam is front-loaded, tapering as the steam expands', 'migflug'],
          ['F/A-18E Super Hornet', '46.45 m² wing, 29,937 kg max, 2 × 97.9 kN', '500 ft², 66,000 lb, 2 × 22,000 lbf', 'aeroweb'],
          ['F-35C Lightning II', '62.1 m² wing, 31,751 kg max, 178 kN', '668 ft², 70,000 lb class, 40,000 lb max', 'f35'],
          ['T-45C Goshawk', '17.66 m² wing, 6,123 kg max, 24.6 kN', '190.1 ft², 13,500 lb, 5,527 lb', 't45b'],
        ]);
        h += `<p class="hint">Not published, so assumed here: the jets’ maximum lift coefficient (1.8), their drag with gear and flaps down, the exact shape of the steam push, and the deck height.</p>`;
        return h;
      },
      keyNumbers() {
        const a = ac(), K = 0.5 * p.m * Lr.vEnd * Lr.vEnd;
        return row('Pull of the catapult', `${pl(p.push, 3)} MN`, p.sys === 'emals' ? `The coils pull this hard all the way, like a Gauss gun 91 m long. With the engines (${si(a.thrust, 'N', 3)}): a = (F + T − D)/m.` : `The average push of the steam pistons; it starts higher and fades.`)
          + row('Speed the wings need', `${pl(Lr.Vs / KN, 3)} kn`, `${pl(Lr.Vs * 3.6, 3)} km/h through the air: below this the wings can’t hold up ${pl(p.m, 4)} kg.`)
          + row('End of the catapult', `${pl(Lr.vEnd / KN, 3)} kn`, `${pl(Lr.vEnd, 3)} m/s after only ${pl(Lr.L, 3)} m and ${pl(Lr.tEnd, 2)} s.`)
          + row('Push on the pilot', `${pl(Lr.peakG, 2)} g`, `a = F/m: ${pl(Lr.peakG, 2)} times the pull of gravity, at its strongest.`)
          + row('Kinetic energy', si(K, 'J', 3), '½mv² at the end of the deck: the same formula as your Gauss gun’s slug.')
          + row('Energy from the ship', si(Lr.Edrawn, 'J', 3), `${Math.round(Lr.sys.eff * 100)} % of it reaches the jet (${p.sys === 'emals' ? 'EMALS' : 'steam'}).`);
      },
      link(sm) {
        const gn = gaussNow(), r = gn && gn.r, g = gn && gn.g, K = 0.5 * p.m * Lr.vEnd * Lr.vEnd;
        const rows = [
          ['What pulls', g ? `${g.stages} coil${g.stages > 1 ? 's' : ''} of ${g.turns} turns, ${g.current} A` : 'coils in a row', `a row of coils 91 m long (EMALS), pulling ${pl(p.push, 3)} MN`],
          ['What is pulled', r ? `an iron slug, ${pl(r.m * 1000, 3)} g` : 'an iron slug', `a shuttle hooked to a ${pl(p.m, 4)} kg jet`],
          ['End speed', r ? `${pl(r.vExit, 3)} m/s` : '–', `${pl(Lr.vEnd, 3)} m/s (${pl(Lr.vEnd / KN, 3)} kn)`],
          ['Kinetic energy, ½mv²', r ? si(r.K, 'J', 3) : '–', si(K, 'J', 3)],
        ];
        if (!sm) rows.push(
          ['How efficient', r ? `${pl(r.eff * 100, 2)} %` : '–', 'about 90 % (steam: about 5 %)'],
          ['When a coil switches on', 'a light gate sees the slug coming', 'a computer switches the coils in step with the shuttle'],
          ['How hard it pushes', 'strongest as the slug enters each coil, nothing in between', 'a steady push all the way, set for each aircraft']);
        return {
          title: 'How is the catapult a Gauss gun?',
          text: sm ? 'EMALS, the electromagnetic catapult on new aircraft carriers, is your coil gun made huge: <b>coils switch on one after another</b> along the deck and pull a shuttle, and the shuttle drags the jet. More current gives a bigger force, and F = ma does the rest. The old steam catapult does the same job with a piston.'
            : `EMALS is a linear motor 91 m long: a row of coils under the deck is switched in sequence, so a magnetic field travels down the track and carries the shuttle with it, exactly the trick your coil gun does with its light gates. Because the computer can shape the current, the push stays steady (about the same g all the way), where a steam catapult gives a hard kick that fades. Same F = ma and ½mv² as your slug, with a ${pl(p.m / 1000, 3)}-tonne jet.`,
          cols: ['Your coil gun', 'Jet catapult'], rows, alt: 'Animation: your coil gun’s coils light up one after another as the slug passes, and so do the coils in the carrier’s deck as the shuttle tows the jet', draw: (c, W, H, t) => drawLinkGauss(c, W, H, t, 'emals'),
        };
      },
      sources: ['emals', 'migflug', 'boeing', 'aeroweb', 'f35', 't45', 't45b', 't45c'],
      whySources: ['emalsw', 'navair'],
      get without() { return p.noCat; },
      setWithout(b) { p.noCat = !!b; },
      why(sm) {
        const a = ac(), A = noCat(), B = withCat(), rw = R.runway({ ac: a, m: p.m, clMax: p.clMax }), kn = v => pl(v / KN, 3);
        const fate = r => r.outcome === 'splash' ? 'into the sea' : r.outcome === 'sink' ? 'drops towards the sea' : r.outcome === 'stuck' ? 'stuck' : 'flies';
        return {
          q: 'Why does a ship need a Gauss gun?',
          a: sm ? `A jet must go fast before its wings can hold it up. On land it gets there on a runway at least ${pl(rw.x, 2)} m long; on a ship it has only ${pl(B.L, 2)} m. With its engines alone it would roll off the bow too slowly and drop into the sea. The catapult’s coils give it the missing speed in about ${(n => `${n} second${n === 1 ? '' : 's'}`)(Math.max(1, Math.round(B.tEnd)))}.`
            : `To fly, the ${a.name} needs about ${kn(rw.Vs)} kn of airspeed (lift = weight at C<sub>L,max</sub>). At full power on a runway that takes at least ${pl(rw.x, 3)} m; a carrier’s catapult track is ${pl(B.L, 3)} m. The catapult adds the missing ½mv² in about ${pl(B.tEnd, 2)} s; EMALS does it with a steady pull instead of steam’s jolt, which is gentler on the jet.`,
          metric: 'Airspeed as the jet leaves the bow',
          mark: { v: rw.Vs / KN, label: `the wing needs ${kn(rw.Vs)} kn` },
          pick: true,
          rows: [
            { k: 'off', label: 'Engines only, no catapult', v: A.Vbow / KN, txt: `${kn(A.Vbow)} kn: ${fate(A)}`, cur: p.noCat },
            { k: 'on', label: `With the catapult (${pl(p.push, 2)} MN)`, v: B.Vbow / KN, txt: `${kn(B.Vbow)} kn: ${fate(B)}`, cur: !p.noCat },
          ],
          verdict: `On land this jet would need at least <b>${pl(rw.x, 3)} m</b> of runway at full power; the catapult does it in ${pl(B.L, 3)} m.`,
        };
      },
      helps() {
        const E = R.launch(Object.assign(base(), { sys: 'emals', push: p.push * 1e6 })), S = R.launch(Object.assign(base(), { sys: 'steam', push: p.push * 1e6 }));
        return [
          ['jet', 'Pilots', `EMALS pulls steadily, about ${pl(E.peakG, 2)} g all the way; steam with the same average pull jolts them with ${pl(S.peakG, 2)} g at the start.`, ''],
          ['wrench', 'Aircraft', 'A smoother push puts less stress on the airframe, so the planes last longer and need less repair.', 'emalsw'],
          ['drone', 'Drones', 'EMALS can launch light unmanned aircraft as well as heavy jets; a steam catapult cannot launch aircraft that light.', 'navair'],
          ['people', 'Sailors', 'No steam pipes under the deck: quieter and cooler places to work and live on board.', 'navair'],
        ];
      },
      home3d: { yaw: -2.62, pitch: 0.24, dist: 44, target: [6, 0, 20], fov: 50, minDist: 6, maxDist: 900, minPitch: 0.03 },
      draw3d(sc, c, W, H, dtr, running) { drawCat3d(sc, c, W, H, dtr, running); },
    };

    /* ---- drawing ---- */
    function drawCat(c, W, H, dtr, running) {
      const s = clamp(W / (W < 560 ? 100 : 145), 2.6, 9), ySea = Math.round(H * 0.8), j = jetAt(anim), a = ac();
      const viewW = W / s, want = j.x - viewW * (j.air ? 0.45 : 0.38);
      const target = clamp(want, -18, 1e5);
      camX = camX == null ? clamp(-14, -18, 1e5) : camX + (target - camX) * clamp(dtr * 3, 0, 1);
      if (!j.air && anim <= 0) camX = Math.min(camX, -14);
      const wantH = Math.max(0, j.h - (ySea - H * 0.28) / s);
      camH += (wantH - camH) * clamp(dtr * 3, 0, 1);
      const X = x => (x - camX) * s, Yh = h => ySea - (h - camH) * s;
      // sunset: the sky, the sun on the horizon, clouds lit from below, and a sea that glitters under the sun
      const seaY = Yh(0), tt = performance.now() / 1000;
      drawSunset(c, W, H, seaY, tt, camX * s);
      // the ship: the flight deck overhangs a raked bow; hangar openings, the waterline band and the bow wave
      const deckY = Yh(p.deckH), xb = X(xBow());
      if (xb > -40) {
        const stemTop = X(xBow() - 7), stemBot = X(xBow() - 16);
        const hg = c.createLinearGradient(0, deckY, 0, seaY); hg.addColorStop(0, '#46505a'); hg.addColorStop(1, '#262c32');
        c.fillStyle = hg; c.beginPath(); c.moveTo(-10, deckY + 3); c.lineTo(stemTop, deckY + 3); c.lineTo(stemTop, deckY + 2.2 * s);
        c.quadraticCurveTo(stemTop - 3 * s, (deckY + seaY) / 2, stemBot, seaY); c.lineTo(-10, seaY); c.closePath(); c.fill();
        c.fillStyle = '#1c2126'; c.fillRect(-10, deckY + 3, stemTop + 10, 2.2 * s - 3);                         // gallery deck under the flight deck
        c.fillStyle = 'rgba(0,0,0,0.45)';
        for (let x = 4; x < xBow() - 26; x += 9) { const sx = X(x); if (sx > -20 && sx < stemTop - 10) c.fillRect(sx, deckY + 4.2 * s, 4.5 * s, 2.6 * s); }   // hangar bay openings
        c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 1; i < 4; i++) c.fillRect(-10, deckY + 3 + (seaY - deckY) * i / 4, stemBot + 10, 1);
        c.fillStyle = '#4b2622'; c.beginPath(); c.moveTo(-10, seaY - 1.6 * s); c.lineTo(stemBot + 0.6 * s, seaY - 1.6 * s); c.lineTo(stemBot, seaY); c.lineTo(-10, seaY); c.closePath(); c.fill();   // anti-fouling paint at the waterline
        const foam = 0.45 + 0.2 * Math.sin(tt * 3.1);
        c.fillStyle = `rgba(225,240,250,${foam})`; c.beginPath(); c.ellipse(stemBot + 2 * s, seaY + 1, 6 * s, 1.1 * s, 0, 0, TAU); c.fill();
        // the flight deck: a slab with a light edge, the yellow line along the catapult and the track itself
        c.fillStyle = '#353c43'; c.fillRect(-10, deckY - 1.5, xb + 10, 4.5);
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(-10, deckY - 1.5, xb + 10, 1);
        c.fillStyle = '#121518'; c.fillRect(X(0), deckY - 1, Lr.L * s, 2.5);
        c.fillStyle = 'rgba(255,200,60,0.55)'; for (let x = -20; x < xBow() - 2; x += 6) c.fillRect(X(x), deckY + 1.6, 2.6 * s, 1);
        if (p.sys === 'emals') {
          // the coils under the track (drawn bigger): each one switches on as the shuttle comes and off once it has passed, like a Gauss gun
          const pitchM = 3, launching = anim > 0 && anim <= Lr.tEnd && !p.noCat;
          for (let x = 0; x < Lr.L; x += pitchM) {
            const xc = x + pitchM / 2, on = launching && xc > j.x - 0.5 && xc < j.x + pitchM * 1.6;
            c.fillStyle = on ? '#ffb020' : '#6a4426'; c.fillRect(X(x) + 0.6, deckY - 1.2, Math.max(1.5, pitchM * s - 1.2), Math.max(2.5, 0.7 * s));
            if (on) glow(c, X(xc), deckY, 3.2 * s, '255,176,32', 0.55);
          }
          if (anim <= Lr.tEnd) text(c, p.noCat ? 'catapult off: the coils in the deck stay dark' : 'coils in the deck (drawn bigger): on as the shuttle comes', X(Lr.L * 0.5), deckY - 2.5 * s - 10, { align: 'center', size: 11.5, color: '#ffd590' });
        }
        const sh = anim <= 0 || p.noCat ? 0 : Math.min(j.x, Lr.L);          // the shuttle that tows the nose gear, stopping at the end of the track
        c.fillStyle = lamp(); c.fillRect(X(sh) - 0.6 * s, deckY - 2.5, 1.2 * s, 2.5);
        // jet blast deflector raised behind the start
        c.fillStyle = '#4a5258'; c.save(); c.translate(X(-a.len * 0.85 - 3), deckY); c.rotate(-0.95); c.fillRect(0, -1.5, 5.5 * s, 3); c.restore();
        text(c, `catapult, ${Math.round(Lr.L)} m`, X(Lr.L / 2), deckY + 2.2 * s + 12, { align: 'center', size: 11, color: 'rgba(214,224,218,0.65)' });
      }
      // steam puffs from the slot
      if (running && p.sys === 'steam' && anim > 0 && anim <= Lr.tEnd && !reduceMotion) for (let i = 0; i < 3; i++) puffs.push({ x: j.x - 2 - Math.random() * 6, h: p.deckH + 0.5, vx: -2 - Math.random() * 3, vh: 2 + Math.random() * 3, r: 1.5, life: 1.6 + Math.random() });
      if (p.sys === 'steam' && !j.air && anim <= 0 && !reduceMotion && Math.random() < 0.2) puffs.push({ x: Math.random() * Lr.L * 0.3, h: p.deckH + 0.3, vx: -0.5, vh: 0.8, r: 1, life: 1.2, faint: 1 });
      for (const q of puffs) { q.life -= dtr; q.x += q.vx * dtr; q.h += q.vh * dtr; q.r += 1.8 * dtr; }
      puffs = puffs.filter(q => q.life > 0);
      for (const q of puffs) { const al = clamp(q.life / 2.2, 0, 1) * (q.faint ? 0.15 : 0.45); glow(c, X(q.x), Yh(q.h), q.r * s, '235,240,245', al); }
      // the flight path so far
      if (j.air && Lr.flight) {
        c.strokeStyle = 'rgba(255,214,140,0.5)'; c.setLineDash([3, 5]); c.lineWidth = 1.4; c.beginPath();
        let first = true; for (const q of Lr.flight.tr) { if (q.t > anim - Lr.tEnd) break; const x = X(Lr.L + q.x), y = Yh(q.h + 0.095 * a.len); first ? c.moveTo(x, y) : c.lineTo(x, y); first = false; }
        c.stroke(); c.setLineDash([]);
      }
      // splash
      if (Lr.outcome === 'splash' && j.air && anim - Lr.tEnd >= tFlight() - 1e-6 && !splashed) { splashed = true; audio.crunch(); for (let i = 0; i < 70; i++) spray.push({ x: j.x, h: 0, vx: (Math.random() - 0.3) * 14, vh: 6 + Math.random() * 16, life: 1 + Math.random() * 1.4 }); }
      for (const q of spray) { q.life -= dtr; q.x += q.vx * dtr; q.h += q.vh * dtr; q.vh -= 9.8 * dtr; }
      spray = spray.filter(q => q.life > 0 && q.h > -1);
      for (const q of spray) { c.fillStyle = `rgba(220,240,255,${clamp(q.life, 0, 1) * 0.8})`; c.fillRect(X(q.x), Yh(q.h), 2, 2); }
      // the jet
      const hide = splashed && Lr.outcome === 'splash';
      if (!hide) drawJet(c, X(j.x), Yh(j.h + 0.095 * a.len), a.len * s, -j.pitch, a, anim > 0 && (running || anim < Lr.tEnd + tFlight()), j);
      drawHud(c, W, H, j);
    }
    /* ---- 3D: the carrier at sunset, the coils in the deck, the jet and its flight ----
       Layers: the sea, the hull, the deck and everything flat on the deck go in the back layer in the order
       they are drawn (the camera never goes below the deck); the island, the jets and the steam are sorted. */
    let cam3 = null;
    const SUN = (() => { const v = [0.966, 0.259, 0.035], l = Math.hypot(...v); return v.map(x => x / l); })();   // low ahead of the ship: it steams into the sunset
    function drawCat3d(sc, c, W, H, dtr, running) {
      const a = ac(), j = jetAt(anim), D = p.deckH, Lj = a.len, xb = xBow(), tt = performance.now() / 1000, B = { layer: 'back' };
      const want = [j.x + (j.air ? -6 : 6), j.air ? j.h : D];
      cam3 = cam3 && anim > 0 ? [cam3[0] + (want[0] - cam3[0]) * clamp(dtr * 2.5, 0, 1), cam3[1] + (want[1] - cam3[1]) * clamp(dtr * 2.5, 0, 1)] : want;
      sc.begin(c, W, H, { dist: W < 600 ? sc.home.dist * 1.3 : undefined, target: [cam3[0], 0, cam3[1]], lift: 0.08, bg: [150, 90, 100], fogNear: 3, fogFar: 40, fogMax: 0.55, backdrop: (g, W2, H2, hy, S) => {
        const q = S.cam([S.eye[0] + SUN[0] * 1e5, S.eye[1] + SUN[1] * 1e5, S.eye[2] + SUN[2] * 1e5]);
        drawSunset(g, W2, H2, hy, tt, 0, q[2] > 0 ? S.cx + S.f * q[0] / q[2] : -9999);
      } });
      const E = sc.eye, far = (pt) => -Math.hypot(pt[0] - E[0], pt[1] - E[1], pt[2] - E[2]);
      // white caps fixed to the sea (so the water moves past as the camera follows the jet), the wake and the bow wave
      const cx0 = Math.round(cam3[0] / 30) * 30;
      for (let gx = -8; gx <= 8; gx++) for (let gy = -8; gy <= 8; gy++) {
        const X0 = cx0 + gx * 30, Y0 = gy * 30, hsh = hash(X0 * 0.37 + Y0 * 1.91);
        if (hsh < 0.35) continue;
        const x = X0 + hash(hsh * 77) * 24, y = Y0 + hash(hsh * 91) * 24, w = 2 + 5 * hash(hsh * 13), ph = 0.5 + 0.5 * Math.sin(tt * 1.3 + hsh * 40);
        if (x > -175 && x < xb + 4 && Math.abs(y) < 34) continue;
        sc.line([x, y - w, 0], [x + 1.2, y + w, 0], `rgba(255,214,190,${0.12 + 0.22 * ph})`, 1.1, B);
      }
      sc.poly([[xb - 6, 0, 0.05], [xb - 70, -30, 0.05], [xb - 70, -18, 0.05]], { rgb: [236, 240, 246], a: 0.22, shade: false, layer: 'back' });
      sc.poly([[xb - 6, 0, 0.05], [xb - 70, 30, 0.05], [xb - 70, 18, 0.05]], { rgb: [236, 240, 246], a: 0.22, shade: false, layer: 'back' });
      sc.poly([[-168, -16, 0.05], [-420, -42, 0.05], [-420, 42, 0.05], [-168, 16, 0.05]], { rgb: [226, 234, 244], a: 0.13, shade: false, layer: 'back' });
      // the hull under the flight deck (a raked bow), its red anti-fouling band, the gallery deck and the hangar openings
      const hull = [[-170, -17], [xb - 34, -17], [xb - 6, 0], [xb - 34, 17], [-170, 17]];
      sc.prism(hull.map(([x, y]) => [x, y * 1.04]), -0.6, 1.4, { rgb: [104, 46, 40], noTop: true, noBottom: true, amb: 0.5, layer: 'back' });
      sc.prism(hull, 1.4, D - 2.2, { rgb: [92, 99, 110], noTop: true, noBottom: true, amb: 0.52, spec: 0.08, layer: 'back' });
      for (let x = -150; x < xb - 44; x += 12) sc.poly([[x, -17.03, D - 9], [x + 6, -17.03, D - 9], [x + 6, -17.03, D - 5.5], [x, -17.03, D - 5.5]], { rgb: [24, 27, 31], out: [0, -1, 0], cull: true, layer: 'back' });
      const deck = [[-170, -24], [xb - 26, -24], [xb, -11], [xb, 13], [xb - 22, 31], [-170, 31]];
      sc.prism(deck, D - 2.2, D, { rgb: [70, 76, 84], topRgb: [64, 69, 77], amb: 0.58, spec: 0.05, noBottom: true, layer: 'back' });
      sc.path(deck.concat([deck[0]]).map(([x, y]) => [x, y, D + 0.03]), 'rgba(215,222,228,0.35)', 1.2, { layer: 'back', chunk: 30 });
      for (let i = 0; i < 26; i++) { const x = -150 + hash(i + 70) * (xb + 120), y = -20 + hash(i + 90) * 46, w = 3 + 9 * hash(i + 110); sc.poly([[x, y, D + 0.01], [x + w, y + 0.4, D + 0.01], [x + w, y + 1.4 + w * 0.1, D + 0.01], [x, y + 1, D + 0.01]], { rgb: [40, 44, 50], a: 0.35, shade: false, out: [0, 0, 1], cull: true, layer: 'back' }); }
      // flat things on the deck: the catapult track, its yellow edge line, the dashed landing-area line
      const flat = (x0, x1, y0, y1, rgb, aa = 1) => sc.poly([[x0, y0, D + 0.02], [x1, y0, D + 0.02], [x1, y1, D + 0.02], [x0, y1, D + 0.02]], { rgb, a: aa, shade: false, out: [0, 0, 1], cull: true, layer: 'back' });
      flat(-2, Lr.L + 1, -1.15, 1.15, [22, 24, 27]);
      for (let x = -34; x < xb - 4; x += 8) flat(x, x + 4.5, 2.2, 2.45, [236, 196, 64], 0.85);
      for (let x = -160; x < xb - 30; x += 10) flat(x, x + 5, 12, 12.3, [232, 236, 240], 0.5);
      if (!j.air) sc.shadow([j.x - 0.3 * Lj, 0, D + 0.03], 0.5 * Lj, 0.36 * Lj, 0.38);
      // the coils in the deck (EMALS), drawn bigger: each switches on as the shuttle comes and off once it has passed
      const launching = anim > 0 && anim <= Lr.tEnd && !p.noCat;
      if (p.sys === 'emals') {
        const coils = [];
        for (let x = 0; x < Lr.L; x += 3) { const xc = x + 1.5; coils.push({ xc, on: launching && xc > j.x - 0.5 && xc < j.x + 4.8, d: far([xc, 0, D]) }); }
        coils.sort((u, v) => u.d - v.d);
        for (const k of coils) sc.box([k.xc, 0, D + 0.16], [1.2, 0.95, 0.16], { rgb: k.on ? [255, 182, 40] : [118, 74, 40], emit: k.on ? '255,140,20' : null, emitA: 0.6, spec: 0.35, shin: 30, amb: 0.6, layer: 'back', skip: o => o[2] < 0 });
        for (const k of coils) if (k.on) sc.glow([k.xc, 0, D + 0.7], 3.2, [255, 176, 32], 0.6, B);
        if (anim <= Lr.tEnd) sc.label([Math.max(j.x + 22, Lr.L * 0.45), -3.5, D + 1.4], p.noCat ? 'catapult off: the coils stay dark' : W < 600 ? 'coils in the deck (drawn bigger)' : 'coils in the deck (drawn bigger): on as the shuttle comes', { color: '#ffd590' });
      } else if (running && launching && !reduceMotion) for (let i = 0; i < 3; i++) puffs.push({ x: j.x - 2 - Math.random() * 6, h: D + 0.5, vx: -2 - Math.random() * 3, vh: 2 + Math.random() * 3, r: 1.5, life: 1.6 + Math.random() });
      // the shuttle that tows the nose gear, stopping at the end of the track
      const sh = anim <= 0 || p.noCat ? 0 : Math.min(j.x, Lr.L);
      sc.box([sh, 0, D + 0.3], [0.7, 0.38, 0.28], { rgb: [255, 190, 50], amb: 0.75, layer: 'back', skip: o => o[2] < 0 });
      // the island (starboard side), its mast and beacon; the jet blast deflector raised behind the jet
      sc.box([-84, -19.8, D + 8], [12, 3.6, 8], { rgb: [96, 103, 114], amb: 0.5, spec: 0.1 });
      sc.box([-86, -19.8, D + 17.2], [5.5, 2.8, 1.2], { rgb: [84, 90, 100], amb: 0.5 });
      sc.box([-73.2, -19.8, D + 13], [0.4, 3.0, 1.1], { rgb: [36, 52, 66], spec: 0.7, shin: 40 });
      sc.cyl([-86, -19.8, D + 18.4], [-86, -19.8, D + 30], 0.35, { rgb: [70, 74, 80], flat: true }, 6);
      sc.glow([-86, -19.8, D + 30.3], 7, [255, 80, 60], 0.7 + 0.3 * Math.sin(tt * 4), { px: true });
      const xd = -Lj * 0.85 - 3;
      sc.poly([[xd, -4.2, D], [xd, 4.2, D], [xd - 2.4, 4.2, D + 3.3], [xd - 2.4, -4.2, D + 3.3]], { rgb: [90, 96, 104], out: [1, 0, 0.6], amb: 0.5 });
      // two jets parked aft by the port edge with their wing tips folded up, to show it is a flight deck
      for (const [x, y] of [[-46, 21], [-66, 21]]) drawJet3d(sc, R.AIRCRAFT.fa18, { x, h: D, pitch: 0, air: false }, D, false, { y, yaw: -2.2, fold: true });
      // steam
      for (const q of puffs) { q.life -= dtr; q.x += q.vx * dtr; q.h += q.vh * dtr; q.r += 1.8 * dtr; }
      puffs = puffs.filter(q => q.life > 0);
      for (const q of puffs) sc.glow([q.x, 0, q.h], q.r, [235, 240, 245], clamp(q.life / 2.2, 0, 1) * 0.45);
      // spray where a jet hits the sea
      if (Lr.outcome === 'splash' && j.air && anim - Lr.tEnd >= tFlight() - 1e-6 && !splashed) { splashed = true; audio.crunch(); for (let i = 0; i < 70; i++) spray.push({ x: j.x, y: (Math.random() - 0.5) * 6, h: 0, vx: (Math.random() - 0.3) * 14, vh: 6 + Math.random() * 16, life: 1 + Math.random() * 1.4 }); }
      for (const q of spray) { q.life -= dtr; q.x += q.vx * dtr; q.h += q.vh * dtr; q.vh -= 9.8 * dtr; }
      spray = spray.filter(q => q.life > 0 && q.h > -1);
      for (const q of spray) sc.glow([q.x, q.y || 0, q.h], 0.9, [220, 240, 255], clamp(q.life, 0, 1) * 0.8);
      // the flight path so far
      if (j.air && Lr.flight) { const pts = []; for (const q of Lr.flight.tr) { if (q.t > anim - Lr.tEnd) break; pts.push([Lr.L + q.x, 0, q.h + 0.095 * Lj]); } if (pts.length > 1) sc.path(pts, 'rgba(255,214,140,0.6)', 1.6, { dash: [4, 6] }); }
      if (!(splashed && Lr.outcome === 'splash')) drawJet3d(sc, a, j, D, anim > 0 && (running || anim < Lr.tEnd + tFlight()));
      sc.end();
      drawHud(c, W, H, j);
    }
    // a jet built from flat panels in its own frame: a along the nose, b to the left wing, c up (all in jet lengths)
    function drawJet3d(sc, a, j, D, lit, o = {}) {
      const Lj = a.len, sp = a.span || Lj * 0.75, th = j.pitch || 0, ps = o.yaw || 0;
      const f = [Math.cos(th) * Math.cos(ps), Math.cos(th) * Math.sin(ps), Math.sin(th)], r = [-Math.sin(ps), Math.cos(ps), 0];
      const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
      const O = [j.x, o.y || 0, j.h + 0.095 * Lj], P = (aa, b, cc) => [0, 1, 2].map(i => O[i] + (f[i] * aa + r[i] * b + u[i] * cc) * Lj);
      const grey = { rgb: a.key === 't45' ? [218, 223, 228] : [150, 160, 170], amb: 0.58, spec: 0.3, shin: 26 };
      const quad = (pts, st2) => sc.poly(pts.map(q => P(...q)), Object.assign({}, grey, st2 || {}));
      // fuselage: a long box with a pointed nose and a flat tail
      const fx0 = -0.75, fx1 = 0.12, hw = 0.055, zt = 0.05, zb = -0.045;
      quad([[fx0, -hw, zt], [fx1, -hw, zt], [fx1, hw, zt], [fx0, hw, zt]]); quad([[fx0, -hw, zb], [fx1, -hw, zb], [fx1, hw, zb], [fx0, hw, zb]]);
      quad([[fx0, -hw, zb], [fx1, -hw, zb], [fx1, -hw, zt], [fx0, -hw, zt]]); quad([[fx0, hw, zb], [fx1, hw, zb], [fx1, hw, zt], [fx0, hw, zt]]);
      quad([[fx0, -hw, zb], [fx0, hw, zb], [fx0, hw, zt], [fx0, -hw, zt]], { rgb: [40, 44, 48] });
      const tip = [0.25, 0, -0.005];
      quad([[fx1, -hw, zt], [fx1, hw, zt], tip]); quad([[fx1, -hw, zb], [fx1, hw, zb], tip]); quad([[fx1, -hw, zb], [fx1, -hw, zt], tip]); quad([[fx1, hw, zb], [fx1, hw, zt], tip]);
      // canopy
      const glass = { rgb: [34, 58, 78], spec: 0.9, shin: 40 };
      quad([[-0.1, -0.03, zt], [0.1, -0.03, zt], [0.06, -0.02, zt + 0.035], [-0.07, -0.02, zt + 0.035]], glass);
      quad([[-0.1, 0.03, zt], [0.1, 0.03, zt], [0.06, 0.02, zt + 0.035], [-0.07, 0.02, zt + 0.035]], glass);
      quad([[-0.07, -0.02, zt + 0.035], [0.06, -0.02, zt + 0.035], [0.06, 0.02, zt + 0.035], [-0.07, 0.02, zt + 0.035]], { rgb: [46, 74, 98], spec: 0.9, shin: 40 });
      // wings (folded up at the tips on a parked jet), tailplanes and the tail fins
      const hs = sp / 2 / Lj, hf = o.fold ? hs * 0.62 : hs;
      for (const sd of [-1, 1]) {
        quad([[-0.2, sd * hw, -0.015], [-0.53, sd * hw, -0.015], [-0.52, sd * hf, -0.02], [-0.36, sd * hf, -0.02]]);
        if (o.fold) quad([[-0.36, sd * hf, -0.02], [-0.52, sd * hf, -0.02], [-0.5, sd * hf, 0.1], [-0.42, sd * hf, 0.1]]);
        quad([[-0.62, sd * hw, -0.02], [-0.76, sd * hw, -0.02], [-0.76, sd * 0.17, -0.022], [-0.69, sd * 0.17, -0.022]]);
        if (a.key !== 't45') quad([[-0.5, sd * 0.035, zt], [-0.68, sd * 0.035, zt], [-0.7, sd * 0.09, zt + 0.17], [-0.6, sd * 0.085, zt + 0.17]], { rgb: [134, 144, 154] });
      }
      if (a.key === 't45') quad([[-0.55, 0, zt], [-0.75, 0, zt], [-0.76, 0, zt + 0.17], [-0.66, 0, zt + 0.17]], { rgb: [200, 60, 50] });
      // landing gear on the deck; the exhaust when the engines run
      if (!j.air) { const g0 = P(0.02, 0, zb), g1 = P(-0.45, -0.1, zb), g2 = P(-0.45, 0.1, zb); for (const g of [g0, g1, g2]) sc.cyl(g, [g[0], g[1], D], g === g0 ? 0.09 : 0.13, { rgb: [40, 40, 44], flat: true }, 6); }
      if (lit) { const n = a.key === 't45' ? [0] : [-0.025, 0.025]; for (const b of n) { sc.glow(P(-0.78, b, 0), Lj * 0.06, [255, 230, 200], 0.9, { core: true }); sc.glow(P(-0.95, b, 0), Lj * (a.ab ? 0.14 : 0.07), [255, 150, 60], a.ab ? 0.55 : 0.25); } }
    }
    function drawJet(c, x, y, len, ang, a, lit, j) {
      // side view; the origin is the nose gear, where the catapult's shuttle pulls
      c.save(); c.translate(x, y); c.rotate(ang);
      const L = len, U = (u, v) => [u * L, v * L], twin = a.key !== 't45', stealth = a.key === 'f35c';
      const poly = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach(([u, v], i) => { const [px, py] = U(u, v); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); c.fill(); };
      const nozzle = U(-0.75, 0);
      if (lit) {                                                    // exhaust: afterburner plume with shock diamonds, or a hot haze
        const fl = L * (a.ab ? 0.5 : 0.22) * (0.92 + 0.1 * Math.sin(performance.now() / 23));
        const g = c.createLinearGradient(nozzle[0], 0, nozzle[0] - fl, 0);
        g.addColorStop(0, a.ab ? 'rgba(255,244,220,0.95)' : 'rgba(255,220,180,0.45)'); g.addColorStop(0.35, a.ab ? 'rgba(255,150,60,0.75)' : 'rgba(255,170,90,0.25)'); g.addColorStop(1, 'rgba(255,90,40,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(nozzle[0], -L * 0.03); c.lineTo(nozzle[0] - fl, 0); c.lineTo(nozzle[0], L * 0.03); c.closePath(); c.fill();
        if (a.ab) for (let k = 1; k <= 3; k++) { c.fillStyle = `rgba(210,235,255,${0.55 - k * 0.13})`; c.beginPath(); c.ellipse(nozzle[0] - fl * k * 0.19, 0, L * 0.011, L * 0.019, 0, 0, TAU); c.fill(); }
        glow(c, nozzle[0] - fl * 0.2, 0, L * 0.22, '255,150,60', a.ab ? 0.32 : 0.12);
      }
      if (twin) poly([[-0.5, -0.05], [-0.62, stealth ? -0.21 : -0.23], [-0.7, stealth ? -0.21 : -0.23], [-0.68, -0.045]], '#4f5961');    // far tail fin
      const body = c.createLinearGradient(0, -L * 0.08, 0, L * 0.05); body.addColorStop(0, '#c3cbd1'); body.addColorStop(0.55, '#929ca4'); body.addColorStop(1, '#5f686f');
      c.fillStyle = body; c.beginPath();
      const B = [[0.25, 0.008], [0.16, -0.035], [0.07, -0.05], [-0.1, -0.056], [-0.55, -0.046], [-0.72, -0.032], [-0.75, -0.026], [-0.75, 0.026], [-0.6, 0.036], [-0.25, 0.044], [0.0, 0.04], [0.12, 0.028]];
      { const [x0, y0] = U(...B[0]); c.moveTo(x0, y0); const [cx1, cy1] = U(0.22, -0.03); const [x1, y1] = U(...B[1]); c.quadraticCurveTo(cx1, cy1, x1, y1); for (let i = 2; i < B.length; i++) { const [px, py] = U(...B[i]); c.lineTo(px, py); } const [cx2, cy2] = U(0.2, 0.024); c.quadraticCurveTo(cx2, cy2, x0, y0); c.closePath(); c.fill(); }
      poly(stealth ? [[0.2, -0.006], [0.07, -0.032], [0.07, -0.022]] : [[0.25, 0.008], [0.2, -0.012], [0.21, 0.004]], 'rgba(40,46,52,0.5)');   // chine / radome line
      // canopy: tandem seats on the trainer
      const can = a.key === 't45' ? [[0.12, -0.04], [0.06, -0.09], [-0.12, -0.09], [-0.16, -0.055]] : [[0.11, -0.042], [0.05, -0.088], [-0.06, -0.085], [-0.1, -0.055]];
      poly(can, '#1e3546'); poly([[can[1][0] - 0.01, can[1][1] + 0.008], [can[2][0] + 0.02, can[2][1] + 0.006], [can[2][0] + 0.03, can[2][1] + 0.016]], 'rgba(200,230,255,0.45)');
      poly(a.key === 't45' ? [[-0.12, -0.03], [-0.2, -0.03], [-0.2, 0.012], [-0.12, 0.012]] : [[-0.04, -0.012], [-0.16, -0.012], [-0.17, 0.034], [-0.05, 0.034]], '#262c31');   // engine intake
      if (a.key === 'fa18') poly([[0.06, -0.006], [-0.22, -0.02], [-0.25, -0.006]], '#a7b0b7');          // leading-edge extension
      poly([[-0.2, 0.004], [-0.5, 0.012], [-0.53, 0.024], [-0.22, 0.02]], '#6b757d');                        // wing, seen edge-on
      poly([[-0.62, 0.008], [-0.76, 0.016], [-0.76, 0.026], [-0.63, 0.022]], '#6b757d');                     // tailplane
      poly([[-0.48, -0.05], [-0.6, stealth ? -0.2 : -0.22], [-0.68, stealth ? -0.2 : -0.22], [-0.66, -0.044]], '#848e96');   // near tail fin
      const fb = U(-0.6, stealth ? -0.17 : -0.19); c.fillStyle = lamp(); c.fillRect(fb[0] - L * 0.035, fb[1], L * 0.055, L * 0.018);
      poly([[-0.75, -0.024], [-0.78, -0.02], [-0.78, 0.02], [-0.75, 0.024]], '#2a2f33');                     // nozzle
      if (!j.air) {                                                    // landing gear, and the launch bar down to the shuttle
        c.strokeStyle = '#2c3237'; c.lineWidth = Math.max(1.5, L * 0.012);
        c.beginPath(); c.moveTo(0, L * 0.03); c.lineTo(0, L * 0.075); c.moveTo(-L * 0.42, L * 0.04); c.lineTo(-L * 0.42, L * 0.075); c.stroke();
        c.fillStyle = '#15191c'; c.beginPath(); c.arc(0, L * 0.079, L * 0.016, 0, TAU); c.fill(); c.beginPath(); c.arc(-L * 0.42, L * 0.077, L * 0.02, 0, TAU); c.fill();
        c.strokeStyle = lamp(); c.lineWidth = Math.max(1.2, L * 0.008); c.beginPath(); c.moveTo(0, L * 0.05); c.lineTo(L * 0.045, L * 0.09); c.stroke();
      }
      c.restore();
    }
    function drawHud(c, W, H, j) {
      // g meter
      const r = clamp(Math.min(W, H) * 0.1, 30, 46), cx = 16 + r, cy = (W < 560 ? 50 : 16) + r, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, gMax = 5;
      c.fillStyle = 'rgba(6,10,12,0.72)'; c.beginPath(); c.arc(cx, cy, r + 6, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, r, a0, a1); c.stroke();
      for (let g = 0; g <= gMax; g++) { const an = a0 + (a1 - a0) * g / gMax; c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx + Math.cos(an) * (r - 7), cy + Math.sin(an) * (r - 7)); c.lineTo(cx + Math.cos(an) * (r - 2), cy + Math.sin(an) * (r - 2)); c.stroke(); }
      const gNow = j.a / G0, an = a0 + (a1 - a0) * clamp(gNow / gMax, 0, 1), ap = a0 + (a1 - a0) * clamp(Lr.peakG / gMax, 0, 1);
      c.strokeStyle = 'rgba(255,120,100,0.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx + Math.cos(ap) * (r - 9), cy + Math.sin(ap) * (r - 9)); c.lineTo(cx + Math.cos(ap) * (r + 1), cy + Math.sin(ap) * (r + 1)); c.stroke();
      c.strokeStyle = lamp(); c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(an) * (r - 5), cy + Math.sin(an) * (r - 5)); c.stroke();
      c.fillStyle = '#ddd'; c.beginPath(); c.arc(cx, cy, 3, 0, TAU); c.fill();
      text(c, `${pl(gNow, 2)} g`, cx, cy + r * 0.5, { align: 'center', size: 14, color: '#ffd590' });
      text(c, 'push on the pilot', cx, cy + r + 14, { align: 'center', size: 11, color: 'rgba(214,224,218,0.7)' });
      // airspeed against stall speed
      const bw = Math.min(200, W * 0.4), bx = W - bw - 64, by = W < 560 ? 52 : 18, vmax = 220;   // clear of the 2D/3D buttons
      rrect(c, bx - 8, by - 6, bw + 16, 50, 7); c.fillStyle = 'rgba(6,10,12,0.72)'; c.fill();
      text(c, `airspeed ${pl(j.V / KN, 3)} kn`, bx, by + 7, { size: 14, color: '#ffd590' });
      text(c, `stall ${pl(Lr.Vs / KN, 3)} kn`, bx + bw, by + 7, { size: 12, align: 'right', color: '#ff9a8a' });
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(bx, by + 22, bw, 7);
      c.fillStyle = j.V >= Lr.Vs ? '#7dffb0' : '#ffb020'; c.fillRect(bx, by + 22, bw * clamp(j.V / KN / vmax, 0, 1), 7);
      const xs = bx + bw * clamp(Lr.Vs / KN / vmax, 0, 1); c.fillStyle = '#ff6b5b'; c.fillRect(xs - 1, by + 19, 2, 13);
      text(c, `wind over deck ${p.wod} kn`, bx, by + 39, { size: 11, color: 'rgba(214,224,218,0.65)' });
    }
    return sim;
  }

  /* =====================================================================
     3. AURORA — one particle on a dipole field line of the Earth
     ===================================================================== */
  function makeAurora() {
    const SCEN = {
      arc: { t: 'Quiet arc', sp: 'e', keV: 5, L: 6.5, pitch: 2, kV: 0, mode: 'one', speed: '1' },
      acc: { t: 'Accelerated arc', sp: 'e', keV: 1, L: 7, pitch: 5, kV: 6, mode: 'one', speed: '1' },
      belt: { t: 'Radiation belt', sp: 'e', keV: 500, L: 4, pitch: 40, kV: 0, mode: 'one', speed: '0.1' },
      proton: { t: 'Proton aurora', sp: 'p', keV: 20, L: 7, pitch: 2, kV: 0, mode: 'one', speed: '10' },
      storm: { t: 'Substorm', sp: 'e', keV: 3, L: 7, pitch: 6, kV: 5, mode: 'burst', speed: '1' },
    };
    const p = { scen: 'arc', sp: 'e', keV: 5, L: 6.5, pitch: 2, kV: 0, mode: 'one' };
    let parts = [], main = null, tSim = 0, hits = [], sView = 0, phase = 0, stars = null, effCache = null, effKey = '', speedWanted = null;
    const ctls = {};
    const sp = () => R.SPECIES[p.sp];
    function newParticle(o) { const P = R.particle(o); P.trail = [[P.r * Math.cos(P.lat) / RE, P.r * Math.sin(P.lat) / RE]]; P.hist = [[0, P.r / RE, o.pitch / DEG]]; return P; }
    function reset() {
      tSim = 0; hits = []; phase = 0;
      main = newParticle({ sp: p.sp, keV: p.keV, L: p.L, pitch: p.pitch * DEG, kV: p.kV, mlt: 0 });
      parts = [main];
      if (p.mode === 'burst') for (let i = 0; i < 39; i++) {
        const L = clamp(p.L + (Math.random() * 2 - 1) * 0.8, 2, 10), keV = p.keV * Math.pow(2, Math.random() * 2 - 1), pitch = Math.max(0.2, Math.random() * p.pitch) * DEG;
        parts.push(newParticle({ sp: p.sp, keV, L, pitch, kV: p.kV, mlt: (Math.random() * 6 - 3 + 24) % 24 }));
      }
    }
    function step(dts) {
      const n = 4;
      for (let k = 1; k <= n; k++) {
        const tt = tSim + dts * k / n;
        for (const P of parts) {
          if (P.done) continue;
          R.advance(P, tt);
          P.trail.push([P.r * Math.cos(P.lat) / RE, P.r * Math.sin(P.lat) / RE]);
          if (P.trail.length > (P === main ? 1400 : 220)) P.trail.shift();
          if (P.done && P.outcome === 'aurora') hits.push({ lat: P.foot.lat, mlt: P.mlt, h: P.foot.h, keV: P.foot.keV, age: 0, main: P === main });
        }
      }
      tSim += dts;
      for (const h of hits) h.age += dts;
      if (main.t - (main.hist.length ? main.hist[main.hist.length - 1][0] : -1) >= Math.max(dts / 4, 1e-4)) { const s = R.state(main); main.hist.push([main.t, s.r / RE, s.pitch / DEG]); if (main.hist.length > 3000) main.hist.splice(0, 2); }
      // finished when every particle reached the air, or the ones still up there have bounced back at least once
      const enough = P => P.done || P.mirrors.length >= (P === main ? 6 : 2);
      return parts.every(enough) && (main.done || main.mirrors.length >= 6);
    }
    function effLossCone() {      // with the accelerator on: the widest pitch angle that still reaches the air (found by running the model)
      const key = [p.sp, p.keV, p.L, p.kV].join();
      if (key === effKey) return effCache;
      effKey = key;
      const lands = a => { const P = R.particle({ sp: p.sp, keV: p.keV, L: p.L, pitch: a, kV: p.kV }); const tb = R.bounceT(p.L, R.kinetic(sp(), p.keV).v, a) * 1.2 + 1; R.advance(P, tb, 60000); return P.outcome === 'aurora'; };
      let lo = 0, hi = Math.PI / 2;
      if (lands(hi - 1e-3)) return (effCache = hi);
      for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (lands(mid)) lo = mid; else hi = mid; }
      return (effCache = lo);
    }
    const colRGB = alt => { const k = R.colourAt(alt); return k === 'red' ? '255,90,80' : k === 'redgreen' ? '220,200,110' : k === 'green' ? '90,255,140' : k === 'greenpink' ? '170,255,160' : '170,120,230'; };
    const colName = alt => { const k = R.colourAt(alt); return k === 'red' ? 'red (oxygen, 630 nm)' : k === 'redgreen' ? 'green with red above it (oxygen)' : k === 'green' ? 'green (oxygen, 557.7 nm)' : k === 'greenpink' ? 'green with a pink-violet lower edge (nitrogen)' : 'little visible light: below about 90 km there is hardly any atomic oxygen left to glow'; };
    function sideNotes() {
      const n = $('#rsAuLNote'); if (n) { const lf = Math.acos(Math.sqrt(1 / p.L)) / DEG; n.innerHTML = `This field line meets the ground at <b>${pl(lf, 3)}°</b> magnetic latitude (cos²λ = 1/L). The auroral oval is near 67° at midnight.`; }
      const k = $('#rsAuKNote'); if (k) { const kin = R.kinetic(sp(), p.keV); k.textContent = `Speed ${pl(kin.v / 1e3, 3)} km/s = ${pl(kin.v / R.C.c, 3)} c${kin.gam > 1.01 ? `, γ = ${pl(kin.gam, 3)}` : ''}.`; }
      const a = $('#rsAuANote'); if (a) { const lc = R.lossCone(p.L, R.absorbAlt(sp(), p.keV)) / DEG; a.innerHTML = `Loss cone on this line: <b>${pl(lc, 3)}°</b>. ${p.pitch <= lc ? 'Inside it: the particle should reach the air.' : 'Outside it: the mirror force should turn it back.'}`; }
    }
    function applyScen(id) { const S = SCEN[id]; Object.assign(p, { scen: id, sp: S.sp, keV: S.keV, L: S.L, pitch: S.pitch, kV: S.kV, mode: S.mode }); speedWanted = S.speed; }
    const sim = {
      go: 'Release', speeds: [['0.1', '1/10 speed'], ['1', 'Real time'], ['10', '10× faster'], ['100', '100× faster']], speed0: '1',
      canvasLabel: 'Cross-section of the Earth and its magnetic field lines, with the particle sliding along one of them, a close-up of its spiral and a map of the auroral oval seen from above the North Pole',
      graphs: ['Distance from the Earth’s centre', 'Pitch angle (90° = mirror point)'],
      wantSpeed() { const w = speedWanted; speedWanted = null; return w; },
      side() {
        return `<div class="panel"><div class="panel-title">Scenario</div><div class="chips" id="rs-au-scen">${Object.entries(SCEN).map(([k, S]) => `<button type="button" class="chip-btn" data-scen="${k}">${S.t}</button>`).join('')}</div><p class="hint" id="rsAuScenNote"></p></div>
          <details class="acc tag-particle" open><summary><span class="acc-title">Particle</span></summary><div class="acc-body">
            <div data-level="expert">${segHTML('au-sp', 'Particle', [['e', 'Electron', 'e⁻'], ['p', 'Proton', 'p⁺']])}</div>
            ${ctl('au-k', 'Energy', 'keV')}<p class="hint" id="rsAuKNote"></p>
            ${ctl('au-a', 'Pitch angle at the equator', '°')}<p class="hint" id="rsAuANote"></p>
            <p class="hint" data-level="beginner">The pitch angle says how the speed is split. Small: it slides quickly along the field line and reaches the sky. Large: it mostly circles, and the stronger field near the pole turns it back like a mirror.</p></div></details>
          <details class="acc tag-copper" open data-level="expert"><summary><span class="acc-title">Field line</span></summary><div class="acc-body">
            ${ctl('au-L', 'Field line L', 'R<sub>E</sub>')}<p class="hint" id="rsAuLNote"></p></div></details>
          <details class="acc tag-hazard" data-level="expert"><summary><span class="acc-title">Auroral accelerator</span><span class="acc-pill" id="rsAuKvPill">off</span></summary><div class="acc-body">
            ${ctl('au-kv', 'Voltage along the field', 'kV')}
            <p class="hint">Above bright arcs an electric field along B, between about 4,000 and 12,000 km up, speeds electrons downwards by a few thousand volts: a natural particle accelerator.</p></div></details>
          <div class="panel" data-level="expert"><div class="panel-title">How many?</div>${segHTML('au-mode', 'How many particles', [['one', 'One particle', ''], ['burst', 'A burst of 40', 'random pitch, L, energy']])}</div>`;
      },
      bind(changed) {
        const sync = () => { for (const b of $$('#rs-au-scen button')) b.classList.toggle('is-on', b.dataset.scen === p.scen); const pill = $('#rsAuKvPill'); if (pill) pill.textContent = p.kV > 0 ? `${pl(p.kV, 3)} kV` : 'off'; const sn = $('#rsAuScenNote'); if (sn) sn.textContent = { arc: 'A plasma-sheet electron inside the loss cone: it reaches the air and makes green light.', acc: 'Just outside the loss cone, so it would bounce back, but the accelerator pushes it in.', belt: 'A fast electron far outside the loss cone: trapped, bouncing between hemispheres (a Van Allen belt).', proton: 'Protons make aurora too (proton aurora). They are 1836 times heavier than electrons, so at the same energy they are slower and spiral wider.', storm: 'Forty electrons near midnight with small pitch angles and an accelerator: watch the oval light up.' }[p.scen] || 'Your own settings.'; };
        this._sync = sync;
        $('#rs-au-scen').addEventListener('click', ev => { const b = ev.target.closest('[data-scen]'); if (!b) return; applyScen(b.dataset.scen); for (const k in ctls) ctls[k].sync(); segSp.sync(); segMode.sync(); changed(); });
        const own = () => { p.scen = ''; };
        const segSp = segInit($('#rs-au-sp'), () => p.sp, v => { p.sp = v; own(); changed(); });
        const segMode = segInit($('#rs-au-mode'), () => p.mode, v => { p.mode = v; own(); changed(); });
        ctls.k = range('au-k', { min: 0.1, max: 1000, log: true, get: () => p.keV, set: v => { p.keV = v; own(); changed(); }, fmt: v => String(+(+v).toPrecision(3)) });
        ctls.a = range('au-a', { min: 0, max: 90, step: 0.1, get: () => p.pitch, set: v => { p.pitch = v; own(); changed(); } });
        ctls.L = range('au-L', { min: 2, max: 10, step: 0.1, get: () => p.L, set: v => { p.L = v; own(); changed(); } });
        ctls.kv = range('au-kv', { min: 0, max: 15, step: 0.5, get: () => p.kV, set: v => { p.kV = v; own(); changed(); } });
        sync();
      },
      reset() { reset(); sideNotes(); if (this._sync) this._sync(); },
      step,
      draw(c, W, H, dtr, running) { drawAurora(c, W, H, dtr, running); },
      home3d: { yaw: -1.12, pitch: 0.36, dist: 10, target: [2.5, 0, 0], fov: 46, minDist: 1.6, maxDist: 200 },
      draw3d(sc, c, W, H, dtr, running) { drawAur3d(sc, c, W, H, dtr, running); },
      clock: () => `t = ${tSim < 1 ? pl(tSim * 1000, 3) + ' ms' : tSim < 120 ? pl(tSim, 3) + ' s' : mmss(tSim)}`,
      status() {
        if (tSim === 0) return [`${sp().name === 'electron' ? 'An electron' : 'A proton'} waits on field line L = ${pl(p.L, 3)}`, ''];
        if (p.mode === 'burst') { const n = parts.filter(P => P.outcome === 'aurora').length; return [`${n} of ${parts.length} have reached the air`, n ? 'is-good' : 'is-run']; }
        if (main.done) return [`Aurora at ${pl(main.foot.lat / DEG, 3)}° ${main.foot.lat > 0 ? 'N' : 'S'}, ${pl(main.foot.h / 1e3, 3)} km up`, 'is-good'];
        if (main.mirrors.length >= 2) return ['Trapped: bouncing between the hemispheres', 'is-warn'];
        if (main.mirrors.length === 1) return ['Turned back by the magnetic mirror', 'is-warn'];
        return [`Spiralling down the field line · ${pl((main.r - RE) / 1e3, 3)} km up`, 'is-run'];
      },
      narrate() {
        const s = R.state(main), lc = R.lossCone(p.L, R.absorbAlt(sp(), p.keV)) / DEG, who = sp().name;
        if (simple()) {
          const An = who === 'electron' ? 'An electron' : 'A proton';
          if (p.mode === 'burst') {
            const n = parts.filter(P => P.outcome === 'aurora').length, tr = parts.filter(P => !P.done && P.mirrors.length).length;
            return tSim === 0 ? `Forty ${who}s at once, all circling Earth’s field lines. Press <b>Release</b> and watch where they light up the sky.` : `<b>${n}</b> have hit the air and lit up the sky; ${tr} were turned back by the magnetic mirror. Each one circles its field line just like a particle in your cyclotron.`;
          }
          if (tSim === 0) return `${An} far out in space is caught by Earth’s magnetic field. Just as in your cyclotron, the field makes it go round in circles: <b>${perSec(s.fg)}</b>, from f = qB/2πm. But nothing here pushes it like your dees do. Instead it <b>slides along the field line</b> while it circles, a corkscrew down towards the pole. Press <b>Release</b>.`;
          if (main.done) return `It hit the air <b>${pl(main.foot.h / 1e3, 3)} km</b> up and made it glow <b>${colName(main.foot.h)}</b>. Near the ground Earth’s field is much stronger, so it was circling ${perSec(s.fg)}.`;
          if (main.mirrors.length) return `Turned back! Near the pole the field gets stronger and squeezes the circles until the ${who} can’t go further: a <b>magnetic mirror</b>.${main.mirrors.length >= 2 ? ' It keeps bouncing between north and south: trapped, as in the Van Allen belts.' : ''}`;
          return `Sliding down the field line. The field gets stronger closer to Earth, so the circles get smaller and faster: <b>${perSec(s.fg)}</b> now, ${pl(s.alt / 1e3, 3)} km up.${s.E ? ' An electric field along the line is speeding it up, the job your dees do.' : ''}`;
        }
        if (p.mode === 'burst') {
          const n = parts.filter(P => P.outcome === 'aurora').length, tr = parts.filter(P => !P.done && P.mirrors.length).length;
          if (tSim === 0) return `Forty ${who}s start near midnight on field lines around L = ${pl(p.L, 3)}, with pitch angles up to ${pl(p.pitch, 3)}°${p.kV ? ` and a ${pl(p.kV, 3)} kV accelerator above the oval` : ''}. Press <b>Release</b> and watch where they land on the map.`;
          return `<b>${n}</b> reached the air and lit the oval between ${pl(Math.min(...parts.map(P => P.L)) > 0 ? Math.acos(Math.sqrt(1 / Math.min(...parts.map(P => P.L)))) / DEG : 0, 3)}° and ${pl(Math.acos(Math.sqrt(1 / Math.max(...parts.map(P => P.L)))) / DEG, 3)}° magnetic latitude; ${tr} were turned back by the mirror and stay trapped. Every one of them followed F = qv × B.`;
        }
        if (tSim === 0) return `A ${pl(p.keV, 3)} keV ${who} starts at the equator ${pl(p.L, 3)} Earth radii out, on the night side. The field there is only ${pl(s.B * 1e9, 3)} nT, yet it circles the field line at <b>${si(s.fg, 'Hz', 3)}</b>: the cyclotron frequency f = |q|B/2πγm, the same formula that sets your cyclotron’s RF. Its pitch angle is ${pl(p.pitch, 3)}°; the loss cone is ${pl(lc, 3)}°.`;
        if (main.done) { const f = main.foot; return `It reached <b>${pl(f.h / 1e3, 3)} km</b> above the ground at ${pl(Math.abs(f.lat) / DEG, 3)}° magnetic latitude after ${f.t < 1 ? pl(f.t * 1000, 3) + ' ms' : pl(f.t, 3) + ' s'}, with ${pl(f.keV, 3)} keV${p.kV && f.keV > p.keV * 1.05 ? ` (${pl(f.keV - p.keV, 3)} keV from the accelerator)` : ''}. ${who === 'electron' ? 'An electron' : 'A proton'} of this energy stops there and makes the air glow <b>${colName(f.h)}</b>. Near the ground the field is ${pl(s.B * 1e6, 3)} μT, so it was spiralling ${si(s.fg, 'Hz', 3)}.`; }
        if (main.mirrors.length) { const m = main.mirrors[0], alt = (R.dip(p.L, m.lat).r - RE) / 1e3; return `At ${pl(alt, 3)} km up its pitch angle reached 90°: μ = p⊥²/2mB stays the same, so as B grew the spiral used up all the motion along the line and the <b>mirror force</b> −μ dB/ds sent it back.${main.mirrors.length >= 3 ? ` It bounces every ${pl(main.mirrors[2].t - main.mirrors[0].t, 3)} s and drifts ${p.sp === 'e' ? 'east' : 'west'} round the Earth (about once every ${fmtDur(R.driftT(sp(), p.L, R.kinetic(sp(), p.keV), p.pitch * DEG))}): trapped, like the Van Allen belts.` : ''}`; }
        return `Sliding down the field line, the ${who} meets a stronger field: B is ${pl(s.B * 1e9, 3)} nT here, so the spiral is tighter (radius ${fmtLen(s.rg)}, ${si(s.fg, 'Hz', 3)}) and the pitch angle has grown to ${pl(s.pitch / DEG, 3)}°.${s.E ? ' It is inside the accelerator: the electric field along B is adding energy.' : ''}`;
      },
      tiles() {
        const s = R.state(main), lc = R.lossCone(p.L, R.absorbAlt(sp(), p.keV)) / DEG;
        return [
          ['Spirals per second', si(s.fg, 'Hz', 3), `f = |q|B/2πγm, B = ${s.B < 1e-6 ? pl(s.B * 1e9, 3) + ' nT' : pl(s.B * 1e6, 3) + ' μT'}`],
          ['Spiral radius', fmtLen(s.rg), `r = p⊥/|q|B · ${pl(s.keV, 3)} keV`],
          ['Pitch angle', `${pl(s.pitch / DEG, 3)}°`, `loss cone ${pl(lc, 3)}° at the start`],
          ['Height', `${pl(s.alt / 1e3, 4)} km`, `latitude ${pl(Math.abs(main.lat) / DEG, 3)}° ${main.lat >= 0 ? 'N' : 'S'}`],
        ];
      },
      graphA(cv) {
        const hs = main.hist, tMax = Math.max(hs.length ? hs[hs.length - 1][0] : 0, 1e-3);
        const r = plot(cv, { xmin: 0, xmax: tMax, ymin: 0, ymax: Math.ceil(p.L + 0.5), xlabel: 'time (s)', ylabel: 'distance (Earth radii)', pad: { r: 16 }, series: [{ pts: hs.map(q => [q[0], q[1]]), color: '#7dffb0', width: 2.2, dot: !main.done }] });
        if (!r) return;
        const c = r.ctx, y1 = r.YP(1);
        c.fillStyle = 'rgba(70,150,220,0.22)'; c.fillRect(r.pad.l, y1, r.pw, r.YP(0) - y1);
        c.fillStyle = 'rgba(150,200,240,0.8)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText('the Earth', r.pad.l + 6, y1 - 2);
      },
      graphB(cv) {
        const hs = main.hist, tMax = Math.max(hs.length ? hs[hs.length - 1][0] : 0, 1e-3), lc = R.lossCone(p.L, R.absorbAlt(sp(), p.keV)) / DEG;
        const r = plot(cv, { xmin: 0, xmax: tMax, ymin: 0, ymax: 180, xlabel: 'time (s)', ylabel: 'pitch angle (°)', pad: { r: 16 }, series: [{ pts: hs.map(q => [q[0], q[2]]), color: '#ffb020', width: 2.2, dot: !main.done }] });
        if (!r) return;
        const c = r.ctx;
        for (const [v, t] of [[90, 'mirror'], [lc, 'loss cone'], [180 - lc, '']]) { const y = Math.round(r.YP(v)) + 0.5; c.strokeStyle = 'rgba(255,214,140,0.35)'; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(r.pad.l, y); c.lineTo(r.W - r.pad.r, y); c.stroke(); c.setLineDash([]); if (t) { c.fillStyle = 'rgba(255,214,140,0.8)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(t, r.W - r.pad.r - 4, y - 2); } }
      },
      numbers() {
        const S = sp(), kin = R.kinetic(S, p.keV), Beq = R.dip(p.L, 0).B, a = p.pitch * DEG, hA = R.absorbAlt(S, p.keV), lf = R.latAtAlt(p.L, hA), Bat = R.dip(p.L, lf).B;
        const pperp = kin.p * Math.sin(a), aq = Math.abs(S.q), lc = R.lossCone(p.L, hA), ml = R.mirrorLat(p.L, a), hm = R.dip(p.L, ml).r - RE;
        const fg0 = aq * Beq / (2 * Math.PI * kin.gam * S.m), rg0 = pperp / (aq * Beq);
        let h = sec('Earth’s magnetic field');
        h += row('Model', 'a dipole', 'Near the Earth the field is close to that of a bar magnet of 8 × 10²² A·m² at the centre: about 30,000 nT at the magnetic equator, 60,000 nT at the poles. Far out on the night side the real field is stretched into a tail, which this model leaves out.', 'r = L·R<sub>E</sub>·cos²λ along a field line;  B = (B₀/L³)·√(1 + 3 sin²λ) / cos⁶λ, B₀ = 30,000 nT');
        h += row('Field where it starts', `${pl(Beq * 1e9, 3)} nT`, `At the equator, ${pl(p.L, 3)} Earth radii out (${pl(p.L * RE / 1e3, 3)} km from the centre).`, `B = B₀/L³ = 30,000 nT / ${pl(p.L, 3)}³ = ${pl(Beq * 1e9, 4)} nT`);
        h += row('Field where it would reach the air', `${pl(Bat * 1e6, 3)} μT`, `At ${pl(hA / 1e3, 3)} km up, ${pl(lf / DEG, 3)}° magnetic latitude: ${pl(Bat / Beq, 4)} times stronger.`, '');
        h += sec(`The ${S.name}`);
        h += row('Speed', `${pl(kin.v / 1e3, 4)} km/s`, `${pl(kin.v / R.C.c, 3)} of the speed of light${kin.gam > 1.01 ? `; relativistic, γ = ${pl(kin.gam, 4)}` : ''}.`, `K = ${pl(p.keV, 4)} keV = ${CL.e(kin.K, 3)} J;  p = √(K² + 2Kmc²)/c,  v = p/γm`);
        h += row('Spiral at the start', `${si(fg0, 'Hz', 3)}, radius ${fmtLen(rg0)}`, 'The cyclotron frequency: in a cyclotron it sets the RF; here it is how fast the particle circles the field line.', `f = |q|B/2πγm = ${CL.e(aq, 4)} C × ${CL.e(Beq, 3)} T / (2π × ${pl(kin.gam, 4)} × ${CL.e(S.m, 4)} kg) = ${si(fg0, 'Hz', 4)};  r = p⊥/|q|B = ${fmtLen(rg0)}`);
        h += sec('Mirror or aurora?');
        h += row('Loss cone', `${pl(lc / DEG, 4)}°`, `Particles whose pitch angle at the equator is smaller than this reach ${pl(hA / 1e3, 3)} km before their spiral uses up all their motion along the line. They are lost to the air: that is the aurora.`, `μ = p⊥²/2mB stays constant, so sin²α / B is the same everywhere: sin²α<sub>LC</sub> = B<sub>eq</sub>/B<sub>air</sub> = ${pl(Beq * 1e9, 4)} nT / ${pl(Bat * 1e9, 5)} nT → α<sub>LC</sub> = ${pl(lc / DEG, 4)}°`);
        h += row('Mirror point', a >= lc ? `${pl(hm / 1e3, 4)} km up, ${pl(ml / DEG, 4)}°` : 'below the air', 'Where the pitch angle reaches 90° (without the accelerator).', `B<sub>mirror</sub> = B<sub>eq</sub>/sin²α = ${pl(Beq * 1e9, 4)} nT / sin²(${pl(p.pitch, 3)}°) = ${a > 0 ? pl(Beq / Math.pow(Math.sin(a), 2) * 1e9, 4) + ' nT' : '∞'}`, a < lc ? 'good' : 'warn');
        if (p.kV > 0) { const eff = effLossCone(); h += row('Loss cone with the accelerator', `${pl(eff / DEG, 3)}°`, `The ${pl(p.kV, 3)} kV push along the field adds energy along B only, so the pitch angle shrinks and more particles fit into the cone (found by running the model).`, `E∥ = ${pl(p.kV * 1e3, 4)} V / ${main.acc ? pl(main.acc.len / 1e3, 4) + ' km' : '–'} = ${main.acc ? pl(main.acc.E * 1e3, 3) + ' mV/m' : '–'} between ${pl(R.AAR.h1 / 1e3, 3)} and ${pl(R.AAR.h2 / 1e3, 3)} km up`); }
        h += row('Where it lands', `${pl(Math.acos(Math.sqrt(1 / p.L)) / DEG, 4)}° magnetic latitude`, 'The foot of the field line. For L between about 6 and 8 that is the auroral oval.', `cos²λ = 1/L = 1/${pl(p.L, 3)}`);
        h += row('Bounce between the hemispheres', fmtDur(R.bounceT(p.L, kin.v, a)), 'For particles that are trapped (textbook formula for a dipole).', `τ ≈ 4·L·R<sub>E</sub>·(1.3802 − 0.3198(y + √y))/v, y = sin α`);
        h += row(`Drift once round the Earth (${S.key === 'e' ? 'eastwards' : 'westwards'})`, fmtDur(R.driftT(S, p.L, kin, a)), 'Caused by the field getting weaker with distance and by the curved field lines; it makes the ring current.', 'τ ≈ π|q|B₀R<sub>E</sub>² / (3L·γmv²/2) / (0.35 + 0.15 sin α)');
        h += sec('The light');
        h += row('Height where it stops', `about ${pl(hA / 1e3, 3)} km`, S.key === 'e' ? 'The more energy, the deeper it gets: about 0.1 keV electrons stop above 160 km, 1–10 keV ones at 90–160 km, over 40 keV ones below 90 km (interpolated in between).' : 'Protons are taken to stop at the usual 100 km.', '');
        h += row('Colour', colName(hA), 'Atomic oxygen glows green at about 100–150 km and red higher up; molecular nitrogen adds violet and pink at the bottom edge.', '');
        return h;
      },
      check() {
        const P = R.particle({ sp: 'e', keV: 5, L: 6.5, pitch: 4 * DEG, kV: 0 }); R.advance(P, 12, 80000);
        const kin = R.kinetic(R.SPECIES.e, 5), bM = P.mirrors.length > 2 ? P.mirrors[2].t - P.mirrors[0].t : NaN, bF = R.bounceT(6.5, kin.v, 4 * DEG);
        const A = R.particle({ sp: 'e', keV: 5, L: 6.5, pitch: 2 * DEG, kV: 0 }); R.advance(A, 10, 80000);
        const lc = R.lossCone(6.5, R.absorbAlt(R.SPECIES.e, 5)), tryA = a => { const Q = R.particle({ sp: 'e', keV: 5, L: 6.5, pitch: a, kV: 0 }); R.advance(Q, 20, 80000); return Q.outcome === 'aurora'; };
        const inOk = tryA(lc * 0.97), outOk = !tryA(lc * 1.03);
        let h = `<p class="hint">The model against what is measured, and against formulas it never uses (the simulation only pushes the particle along with the mirror force −μ dB/ds).</p>`;
        h += cmpTable([
          ['Field at the equator and the poles', '30,000 nT and 60,000 nT', 'about 30,000 and 60,000 nT', 'gsfc', 'good'],
          ['Where a quiet arc lands (L = 6.5)', A.foot ? `${pl(A.foot.lat / DEG, 3)}°` : '–', 'oval near 67° magnetic latitude at midnight', 'ams', 'good'],
          ['Energy of arc electrons', '1–10 keV (with the accelerator)', 'several keV; light at about 100 km', 'arase', 'good'],
          ['Accelerator height', '4,000 to 12,000 km', 'typically 4,000 to 12,000 km', 'cluster', 'good'],
          ['Green and red light', 'green below 150 km, red above', 'green about 100–150 km, red higher', 'atopt', 'good'],
          ['Loss cone, 5 keV e⁻ on L = 6.5', `at ${pl(lc * 0.97 / DEG, 3)}° it ${inOk ? 'lands' : 'bounces'}, at ${pl(lc * 1.03 / DEG, 3)}° it ${outOk ? 'bounces' : 'lands'} (simulated)`, `${pl(lc / DEG, 4)}° from sin²α = B<sub>eq</sub>/B<sub>air</sub>`, null, inOk && outOk ? 'good' : 'bad'],
          ['Bounce time, same electron', `${pl(bM, 4)} s (simulated)`, `${pl(bF, 4)} s (textbook formula)`, null, Math.abs(bM / bF - 1) < 0.03 ? 'good' : 'warn'],
        ]);
        h += `<p class="hint">Simplified: the field is a perfect dipole (no tail, no tilt), the particle does not collide on the way, and the accelerator is a steady voltage spread evenly along the field line.</p>`;
        return h;
      },
      keyNumbers() {
        const k = R.kinetic(sp(), p.keV), Bf = R.dip(p.L, 0).B, la = R.latAtAlt(p.L, 110e3), Bn = la == null ? Bf : R.dip(p.L, la).B;
        const fOf = B => Math.abs(sp().q) * B / (2 * Math.PI * k.gam * sp().m), lc = R.lossCone(p.L, R.absorbAlt(sp(), p.keV)) / DEG;
        let h = row('Circles far out in space', perSec(fOf(Bf)), `f = qB/2πm with Earth’s field there, only ${fmtB(Bf)}: your cyclotron’s formula.`)
          + row('Circles near the ground', perSec(fOf(Bn)), `About 110 km up the field is ${fmtB(Bn)}, so it circles faster and tighter.`)
          + row('Speed', `${pl(k.v / 1e3, 3)} km/s`, `${pl(k.v / R.C.c * 100, 3)} % of the speed of light, from its energy of ${pl(p.keV, 3)} keV.`)
          + row('Loss cone', `${pl(lc, 3)}°`, `Start with a pitch angle smaller than this and it reaches the air; larger, and the mirror turns it back. You set ${pl(p.pitch, 3)}°.`);
        if (main.done) h += row('Where it glowed', `${pl(main.foot.h / 1e3, 3)} km up`, `The air there glows ${colName(main.foot.h)}.`);
        return h;
      },
      link(sm) {
        const lab = labNow(), k = R.kinetic(sp(), p.keV), Bf = R.dip(p.L, 0).B, la = R.latAtAlt(p.L, 110e3), Bn = la == null ? Bf : R.dip(p.L, la).B;
        const fOf = B => Math.abs(sp().q) * B / (2 * Math.PI * k.gam * sp().m), rf = k.gam * sp().m * k.v * Math.sin(p.pitch * DEG) / (Math.abs(sp().q) * Bf);
        const rows = [
          ['Particle', lab ? `${lab.part.name} (${lab.part.symbol})` : 'proton', `${sp().name} (${sp().sym}) from space`],
          ['Magnetic field', lab ? `${fmtB(lab.B)} from your electromagnet` : 'about 1 T', `Earth’s: ${fmtB(Bf)} far out, ${fmtB(Bn)} near the ground`],
          ['Circles per second, f = qB/2πm', lab ? si(lab.fc, 'Hz', 3) : '–', `${si(fOf(Bf), 'Hz', 3)} far out, ${si(fOf(Bn), 'Hz', 3)} near the ground`],
          ['What makes it faster', lab ? `the dees’ electric field: +${en(lab.gain)} each turn` : 'the dees’ electric field', 'not the magnetic field (it never does work); above bright arcs an electric field along B adds a few keV'],
        ];
        if (!sm) rows.push(
          ['Size of the circle, r = mv⊥/qB', lab ? `grows up to R = ${pl(lab.R, 3)} m` : '–', `${fmtLenS(rf)} far out, shrinking on the way down`],
          ['Shape of the path', 'a flat spiral: each push makes the circle bigger', 'a helix along the field line: it circles and slides at once'],
          ['Turned back by', 'nothing: it leaves at the edge of the dees', 'the magnetic mirror, where B grows near the pole']);
        return {
          title: 'How is the aurora like your cyclotron?',
          text: sm ? `In your cyclotron a magnet makes a particle go round in circles, f = qB/2πm. <b>Earth is a giant magnet</b> and does the same to ${sp().name}s from space, with the same formula. The difference: nothing out there pushes them round like your dees do. Instead they slide along the field line while they circle, a corkscrew down to the polar sky, where they hit the air and make it glow.`
            : `The same Lorentz force, F = qv × B. The part of the velocity across B goes round in circles at f = |q|B/2πγm, your cyclotron’s frequency; the part along B is untouched, so the path is a helix. Earth’s field grows towards the poles, so the circles get tighter and faster, and because μ = p⊥²/2mB stays the same the circling can use up all the motion along B: the magnetic mirror. A magnetic force never changes a particle’s speed. In your cyclotron the dees’ electric field does that; above bright arcs, an electric field along B does it.`,
          cols: ['Your cyclotron', 'The aurora'], rows, alt: 'Animation: on the left your cyclotron’s growing spiral, on the right an electron spiralling along one of Earth’s field lines down to the polar sky',
          draw: (c, W, H, t) => drawLinkCyclo(c, W, H, t, { b: `Earth’s B: ${fmtB(Bf)} far out`, f: `circles ${perSec(fOf(Bf))}` }),
        };
      },
      sources: ['gsfc', 'uw', 'ams', 'hb', 'cluster', 'arase', 'noaa', 'wauro', 'atopt'],
    };
    const fmtLen = m => m >= 1000 ? `${pl(m / 1000, 3)} km` : m >= 1 ? `${pl(m, 3)} m` : `${pl(m * 100, 3)} cm`;
    const fmtDur = t => t < 1 ? `${pl(t * 1000, 3)} ms` : t < 120 ? `${pl(t, 3)} s` : t < 7200 ? `${pl(t / 60, 3)} min` : t < 172800 ? `${pl(t / 3600, 3)} hours` : `${pl(t / 86400, 3)} days`;

    /* ---- drawing ---- */
    function drawAurora(c, W, H, dtr, running) {
      const wide = W >= 620, side = wide ? Math.min(W * 0.32, 330) : 0, mw = W - side;
      const Lv = p.mode === 'burst' ? Math.min(10, p.L + 0.8) : p.L;
      const xr = Lv + 0.8, xl = 2.3, zh = Math.max(0.385 * Lv + 0.55, 1.6);
      const sWant = Math.min((mw - 24) / (xr + xl), (H - 36) / (2 * zh));
      sView = sView ? sView + (sWant - sView) * clamp(dtr * 4, 0, 1) : sWant;
      const s = sView, cx = 12 + xl * s + Math.max(0, (mw - 24 - (xr + xl) * s) / 2), cy = H / 2;
      const P2 = (x, z) => [cx + x * s, cy - z * s];
      // space
      c.fillStyle = '#02040a'; c.fillRect(0, 0, W, H);
      drawStars(c, W, H, performance.now() / 1000);
      // the Sun's side
      const sunG = c.createLinearGradient(0, 0, cx - s * 1.2, 0); sunG.addColorStop(0, 'rgba(255,200,120,0.16)'); sunG.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = sunG; c.fillRect(0, 0, cx - s, H);
      const ty = wide ? 16 : 46;
      text(c, 'Sun', 10, ty, { size: 13, color: 'rgba(255,214,140,0.85)' });
      text(c, 'night side', wide ? mw - 10 : W * 0.5, ty, { size: 13, align: wide ? 'right' : 'center', color: 'rgba(170,190,230,0.75)' });
      // field lines
      c.lineWidth = 1;
      for (let L = 2; L <= 10; L++) {
        const lf = Math.acos(Math.sqrt(1 / L));
        for (const sd of [-1, 1]) { c.strokeStyle = 'rgba(150,170,255,0.16)'; c.beginPath(); for (let i = 0; i <= 80; i++) { const la = -lf + 2 * lf * i / 80, r = L * Math.cos(la) ** 2, [x, y] = P2(sd * r * Math.cos(la), r * Math.sin(la)); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
      }
      const drawLine = (L, col, w, la0, la1) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (let i = 0; i <= 90; i++) { const la = la0 + (la1 - la0) * i / 90, r = L * Math.cos(la) ** 2, [x, y] = P2(r * Math.cos(la), r * Math.sin(la)); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); };
      const lfp = Math.acos(Math.sqrt(1 / p.L));
      drawLine(p.L, 'rgba(255,190,90,0.6)', 1.6, -lfp, lfp);
      if (main.acc) for (const sg of [1, -1]) drawLine(p.L, 'rgba(190,120,255,0.75)', 5, sg * main.acc.lo, sg * main.acc.hi);
      // the Earth: day side lit from the left, the thin glowing air, the aurora where particles landed
      const er = s, eg = c.createRadialGradient(cx - er * 0.45, cy - er * 0.3, er * 0.1, cx, cy, er);
      eg.addColorStop(0, '#3b7fc0'); eg.addColorStop(0.55, '#1d4f80'); eg.addColorStop(1, '#0c2742');
      c.fillStyle = eg; c.beginPath(); c.arc(cx, cy, er, 0, TAU); c.fill();
      c.fillStyle = 'rgba(0,0,10,0.55)'; c.beginPath(); c.arc(cx, cy, er, -Math.PI / 2, Math.PI / 2); c.fill();
      c.strokeStyle = 'rgba(120,190,255,0.45)'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, er * 1.03, 0, TAU); c.stroke();
      for (const hh of hits) {
        const a = clamp(1 - hh.age / (p.mode === 'burst' ? 30 : 60), 0.15, 1), [x, y] = P2((1 + hh.h / RE) * Math.cos(hh.lat), (1 + hh.h / RE) * Math.sin(hh.lat));
        glow(c, x, y, p.mode === 'burst' ? 4 + 5 * a : 8 + 10 * a, colRGB(hh.h), (p.mode === 'burst' ? 0.3 : 0.55) * a);
      }
      text(c, `${pl(lfp / DEG, 3)}°`, P2(Math.cos(lfp) * 1.08, Math.sin(lfp) * 1.08)[0] + 6, P2(Math.cos(lfp) * 1.08, Math.sin(lfp) * 1.08)[1] - 6, { size: 11.5, color: 'rgba(255,214,140,0.9)' });
      // the particles
      const rgb = p.sp === 'e' ? '120,210,255' : '255,150,110';
      for (const P of parts) {
        const tr = P.trail, isMain = P === main;
        if (tr.length > 1) {
          c.strokeStyle = `rgba(${rgb},${isMain ? 0.85 : 0.35})`; c.lineWidth = isMain ? 1.8 : 1; c.beginPath();
          for (let i = 0; i < tr.length; i++) { const [x, y] = P2(tr[i][0], tr[i][1]); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
        }
        const [x, y] = P2(P.r * Math.cos(P.lat) / RE, P.r * Math.sin(P.lat) / RE);
        if (!P.done) { glow(c, x, y, isMain ? 12 : 6, rgb, 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, isMain ? 2.4 : 1.4, 0, TAU); c.fill(); }
        if (isMain) for (const m of P.mirrors.slice(-2)) { const d = R.dip(P.L, m.lat), [mx, my] = P2(d.r * Math.cos(m.lat) / RE, d.r * Math.sin(m.lat) / RE); c.strokeStyle = 'rgba(255,214,140,0.9)'; c.lineWidth = 1.5; c.beginPath(); c.arc(mx, my, 5, 0, TAU); c.stroke(); text(c, 'mirror', mx + 8, my, { size: 11, color: 'rgba(255,214,140,0.9)' }); }
      }
      // the start, with the loss cone drawn at its real width
      const [sx, sy] = P2(p.L, 0);
      text(c, 'start', sx + 9, sy - 9, { size: 11, color: 'rgba(214,224,218,0.75)' });
      const cr = wide ? 40 : 30; drawCone(c, 14 + cr, H - cr - 30, cr);
      if (main.acc) { const la = (main.acc.lo + main.acc.hi) / 2, r = p.L * Math.cos(la) ** 2, [ax, ay] = P2(r * Math.cos(la), r * Math.sin(la)); text(c, `${pl(p.kV, 3)} kV accelerator`, ax + 10, ay - 4, { size: 11.5, color: 'rgba(210,170,255,0.95)' }); }
      drawPanels(c, W, H, dtr, running);
    }
    // the side panels: close-up of the spiral, the oval seen from above, where the light is made
    function drawPanels(c, W, H, dtr, running) {
      const wide = W >= 620, side = wide ? Math.min(W * 0.32, 330) : 0, mw = W - side;
      if (wide) {
        c.fillStyle = 'rgba(2,4,10,0.55)'; c.fillRect(mw, 0, side, H);
        const r1 = Math.min(side * 0.36, H * 0.2), lx = mw + side / 2, ly = 12 + r1;
        drawLens(c, lx, ly, r1, dtr, running);
        const top = ly + r1 + 54, r2 = Math.min(side * 0.3, (H - top - 26) / 2), px = mw + side * 0.43, py = top + r2;
        if (r2 > 28) { drawPolar(c, px, py, r2); drawBar(c, px + r2 + 22, py - r2, r2 * 2); }
      } else {
        const r1 = Math.min(W * 0.17, 62); drawLens(c, W - r1 - 56, r1 + 34, r1, dtr, running);
        const r2 = Math.min(W * 0.15, 54); drawPolar(c, W - r2 - 26, H - r2 - 24, r2);
      }
    }
    /* ---- 3D: the Earth in space, its field lines, the particle sliding along one and the aurora where it lands.
       Space is drawn in Earth radii; the Sun is far off along −x, midnight is +x, dawn (06 h) is +y, north is +z. */
    let v3d = null;
    const MLTdir = h => [Math.cos(h / 24 * TAU), Math.sin(h / 24 * TAU)];
    const meri = (xm, zm, h) => { const d = MLTdir(h); return [xm * d[0], xm * d[1], zm]; };
    function fieldPts(L, h, la0, la1, n = 40) { const pts = []; for (let i = 0; i <= n; i++) { const la = la0 + (la1 - la0) * i / n, r = L * Math.cos(la) ** 2; pts.push(meri(r * Math.cos(la), r * Math.sin(la), h)); } return pts; }
    function drawAur3d(sc, c, W, H, dtr, running) {
      const wide = W >= 620, side = wide ? Math.min(W * 0.32, 330) : W * 0.22, mw = W - side, tt = performance.now() / 1000;
      const Lv = p.mode === 'burst' ? Math.min(10, p.L + 0.8) : p.L, fov = 46;
      const f = 0.5 * Math.min(W * 0.85, H * 1.05) / Math.tan(fov * Math.PI / 360);
      const want = Math.max((Lv + 3.1) / 2 * f / Math.max(60, mw / 2 - 24), (0.385 * Lv + 0.8) * f / Math.max(60, H / 2 - 34)) * 1.12;
      v3d = v3d ? v3d + (want - v3d) * clamp(dtr * 4, 0, 1) : want;
      const SUN = [-1, 0, 0];
      sc.begin(c, W, H, { dist: v3d, target: [(Lv - 1.5) / 2, 0, 0], shift: -side / 2 / W, fog: false, fov, backdrop: (g, W2, H2, hy, S) => {
        g.fillStyle = '#02040a'; g.fillRect(0, 0, W2, H2);
        drawSky3d(g, W2, H2, S, tt);
        // the Sun: on screen when the camera looks its way, otherwise its light comes in from that edge
        const q = skyPoint(S, SUN), dx = v3dot(SUN, S.Rw), dy = -v3dot(SUN, S.Uw), dl = Math.hypot(dx, dy) || 1, mx = S.cx, my = S.cy;
        const on = q && q[0] > -60 && q[0] < W2 + 60 && q[1] > -60 && q[1] < H2 + 60;
        const ex = on ? q[0] : mx + dx / dl * W2 * 0.75, ey = on ? q[1] : my + dy / dl * H2 * 0.75;
        glow(g, ex, ey, Math.max(W2, H2) * 0.7, '255,190,110', 0.16);
        if (on) { glow(g, ex, ey, 60, '255,230,180', 0.8); g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(ex, ey, 14, 0, TAU); g.fill(); }
        text(g, 'Sun', clamp(ex, 16, W2 - 60), clamp(ey, 18, H2 - 18), { size: 13, color: 'rgba(255,214,140,0.9)' });
      } });
      addEarth(sc, SUN);
      // the polar caps, and the average auroral oval: about 67° at midnight, 75° at noon
      for (const sg of [1, -1]) {
        const cap = []; for (let i = 0; i < 28; i++) { const a = TAU * i / 28, la = 78 * DEG; cap.push([1.003 * Math.cos(la) * Math.cos(a), 1.003 * Math.cos(la) * Math.sin(a), sg * 1.003 * Math.sin(la)]); }
        sc.poly(cap, { rgb: [225, 236, 245], a: 0.5, shade: false });
        const ov = []; for (let i = 0; i <= 72; i++) { const h = 24 * i / 72, la = (71 - 4 * Math.cos(h / 24 * TAU)) * DEG, r = 1.02; ov.push(meri(r * Math.cos(la), sg * r * Math.sin(la), h)); }
        sc.path(ov, 'rgba(90,255,140,0.22)', 3, { chunk: 3 });
      }
      // field lines: the noon–midnight plane in full, a few more around the Earth, the particle's own line in orange
      for (let L = 2; L <= 10; L++) { const lf = Math.acos(Math.sqrt(1 / L)); for (const h of [0, 12]) sc.path(fieldPts(L, h, -lf, lf), 'rgba(150,170,255,0.28)', 1); }
      for (const L of [3, 5, 7, 9]) { const lf = Math.acos(Math.sqrt(1 / L)); for (const h of [3, 6, 9, 15, 18, 21]) sc.path(fieldPts(L, h, -lf, lf, 30), 'rgba(150,170,255,0.13)', 1); }
      const lfp = Math.acos(Math.sqrt(1 / p.L));
      sc.path(fieldPts(p.L, main.mlt, -lfp, lfp, 80), 'rgba(255,190,90,0.7)', 1.8);
      if (main.acc) for (const sg of [1, -1]) sc.path(fieldPts(p.L, main.mlt, sg * main.acc.lo, sg * main.acc.hi, 16), 'rgba(190,120,255,0.8)', 5);
      // the aurora where particles landed: a glow at the height where the light is made, and a short curtain above it
      for (const hh of hits) {
        const a = clamp(1 - hh.age / (p.mode === 'burst' ? 30 : 60), 0.15, 1), r0 = 1 + hh.h / RE, big = p.mode !== 'burst';
        for (let i = 0; i < 6; i++) { const r = r0 + i * 0.03, h = hh.h + i * 0.03 * RE / 3; sc.glow(meri(r * Math.cos(hh.lat), r * Math.sin(hh.lat), hh.mlt), (big ? 0.16 : 0.07) * (1 - i * 0.1), colRGB(h).split(',').map(Number), (big ? 0.7 : 0.4) * a * (1 - i * 0.13)); }
      }
      // the particles: the path of each one's centre of circling, and where it is now
      const rgb = p.sp === 'e' ? [120, 210, 255] : [255, 150, 110];
      for (const P of parts) {
        const isMain = P === main, tr = P.trail;
        if (tr.length > 1) sc.path(tr.map(q => meri(q[0], q[1], P.mlt)), `rgba(${rgb},${isMain ? 0.9 : 0.35})`, isMain ? 2.2 : 1, { chunk: 8, bias: -0.02 });
        const pos = meri(P.r * Math.cos(P.lat) / RE, P.r * Math.sin(P.lat) / RE, P.mlt);
        if (!P.done) { sc.glow(pos, isMain ? 13 : 6, rgb, 0.9, { px: true, core: true }); }
      }
      // the spiral around the field line, drawn much bigger than it is, turning the way the charge turns
      if (!main.done) {
        const st = R.state(main), la = main.lat, tx = -3 * Math.sin(la) * Math.cos(la), tz = Math.cos(la) ** 2 - 2 * Math.sin(la) ** 2, tl = Math.hypot(tx, tz);
        const Bh = meri(tx / tl, tz / tl, main.mlt), d = MLTdir(main.mlt), n1 = [-d[1], d[0], 0], n2 = v3x(Bh, n1);
        const P0 = meri(main.r * Math.cos(la) / RE, main.r * Math.sin(la) / RE, main.mlt), A = 0.11 * Math.max(1, Lv / 6.5), S = 0.55 * Math.max(1, Lv / 6.5);
        const wq = main.sp.q < 0 ? 1 : -1, dp = st.vpar >= 0 ? 1 : -1, K = TAU * 3.5 / (2 * S), th0 = TAU * phase * wq;
        const past = [], next = [];
        for (let i = 0; i <= 120; i++) {
          const s2 = -S + 2 * S * i / 120, th = th0 + wq * dp * K * s2, q = [0, 1, 2].map(k => P0[k] + Bh[k] * s2 + A * (n1[k] * Math.cos(th) + n2[k] * Math.sin(th)));
          (s2 * dp <= 0 ? past : next).push(q);
        }
        if (past.length > 1) sc.path(past, `rgba(${rgb},0.9)`, 2, { chunk: 3 });
        if (next.length > 1) sc.path(next, `rgba(${rgb},0.25)`, 1.2, { chunk: 3 });
        if (wide) sc.label([P0[0] + n2[0] * A * 2.2, P0[1] + n2[1] * A * 2.2, P0[2] + n2[2] * A * 2.2 + A * 1.6], `spiral drawn far bigger: real radius ${fmtLen(st.rg)}`, { color: 'rgba(214,232,240,0.9)', font: '600 12px "Barlow Condensed", "Arial Narrow", sans-serif' });
      }
      // mirror points: a ring across the field where the particle turned back
      for (const m of main.mirrors.slice(-2)) {
        const dd = R.dip(main.L, m.lat), la = m.lat, tx = -3 * Math.sin(la) * Math.cos(la), tz = Math.cos(la) ** 2 - 2 * Math.sin(la) ** 2;
        const pm = meri(dd.r * Math.cos(la) / RE, dd.r * Math.sin(la) / RE, main.mlt);
        sc.circle(pm, v3n(meri(tx, tz, main.mlt)), 0.14, 'rgba(255,214,140,0.95)', 1.6);
        sc.label(pm, 'mirror', { dx: 30, color: 'rgba(255,214,140,0.95)' });
      }
      sc.label(meri(p.L, 0, main.mlt), 'start', { dx: 18, dy: -12, color: 'rgba(214,224,218,0.8)' });
      sc.label(meri(Math.cos(lfp) * 1.12, Math.sin(lfp) * 1.12, main.mlt), `${pl(lfp / DEG, 3)}°`, { dx: 16, color: 'rgba(255,214,140,0.95)' });
      if (main.acc) { const la = (main.acc.lo + main.acc.hi) / 2, r = p.L * Math.cos(la) ** 2; sc.label(meri(r * Math.cos(la), r * Math.sin(la), main.mlt), `${pl(p.kV, 3)} kV accelerator`, { dx: 60, color: 'rgba(210,170,255,0.95)' }); }
      sc.end();
      const cr = wide ? 40 : 30; drawCone(c, 14 + cr, H - cr - 30, cr);
      drawPanels(c, W, H, dtr, running);
    }
    function drawCone(c, x, y, r) {
      // velocity directions at the start: B points north (up); the loss cones around ±B; the particle's pitch angle
      const lc = R.lossCone(p.L, R.absorbAlt(sp(), p.keV));
      c.fillStyle = 'rgba(6,10,12,0.7)'; c.beginPath(); c.arc(x, y, r + 6, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      for (const sg of [-1, 1]) { c.fillStyle = 'rgba(90,255,140,0.35)'; c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, -Math.PI / 2 * sg - lc, -Math.PI / 2 * sg + lc); c.closePath(); c.fill(); c.strokeStyle = 'rgba(90,255,140,0.9)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(-Math.PI / 2 * sg - lc) * r, y + Math.sin(-Math.PI / 2 * sg - lc) * r); c.moveTo(x, y); c.lineTo(x + Math.cos(-Math.PI / 2 * sg + lc) * r, y + Math.sin(-Math.PI / 2 * sg + lc) * r); c.stroke(); }
      const a = -Math.PI / 2 + p.pitch * DEG;
      CL.arrow(c, x, y, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92, 8, '#ffd590', 2);
      text(c, 'B', x - 4, y - r - 9, { size: 12, color: 'rgba(150,170,255,0.9)', align: 'center' });
      text(c, 'loss cone', x, y + r + 12, { size: 10.5, align: 'center', color: 'rgba(120,255,160,0.85)' });
    }
    function drawLens(c, x, y, r, dtr, running) {
      const s = R.state(main);
      if (running && !main.done) phase += dtr * 0.9 * (reduceMotion ? 0.3 : 1);
      c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
      c.fillStyle = '#04070b'; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      // drawn to scale across B; along B the spacing of the turns is squeezed or spread only when it would not show
      // the true ratio (turn spacing / radius = 2π/tan α) runs from about 0 to several hundred, so it is drawn compressed
      // (the drawn ratio grows as the 0.35 power of the true one); the caption gives the true spacing
      const A = 0.3 * r, pitchLen = Math.abs(s.vpar) / Math.max(s.fg, 1e-9), ratio = pitchLen / Math.max(s.rg, 1e-12);
      const shown = clamp(0.9 * Math.pow(ratio, 0.35), 0.5, 2.8), P = shown * A, k = ratio / shown;
      const scaleNote = k > 1.08 ? `turns drawn ${pl(k, 2)}× closer than real` : k < 1 / 1.08 ? `turns drawn ${pl(1 / k, 2)}× further apart` : 'drawn to scale';
      // the field line through the middle
      c.strokeStyle = 'rgba(150,170,255,0.45)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.stroke(); c.setLineDash([]);
      CL.arrow(c, x + r * 0.42, y - r * 0.8, x + r * 0.72, y - r * 0.8, 7, 'rgba(150,170,255,0.9)', 1.6);
      text(c, 'B', x + r * 0.37, y - r * 0.8, { size: 12, align: 'right', color: 'rgba(150,170,255,0.95)' });
      // the spiral seen slightly from the side: the half in front bright, the half behind dim; the particle in the middle
      const sgn = main.sp.q < 0 ? 1 : -1, dirPar = s.vpar >= 0 ? 1 : -1, n0 = phase;
      const pt = n => { const th = 2 * Math.PI * (n - n0) * sgn + Math.PI / 2, z = Math.sin(th); return [x + (n - n0) * P * dirPar - z * A * 0.5, y - A * Math.cos(th) + z * A * 0.12, z]; };
      const rgb = p.sp === 'e' ? '120,210,255' : '255,150,110', span = Math.max(1.4, 1.15 * r / P);
      for (const front of [false, true]) {
        let prev = pt(n0 - span);
        for (let i = 1; i <= 260; i++) {
          const n = n0 - span + 2 * span * i / 260, q = pt(n);
          if ((q[2] > 0) === front) { const past = (n - n0) * dirPar < 0 ? 1 : 0.55; c.strokeStyle = `rgba(${rgb},${(front ? 0.95 : 0.28) * past})`; c.lineWidth = front ? 2.1 : 1.2; c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(q[0], q[1]); c.stroke(); }
          prev = q;
        }
      }
      const q0 = pt(n0); glow(c, q0[0], q0[1], 10, rgb, 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(q0[0], q0[1], 2.5, 0, TAU); c.fill();
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      text(c, `radius ${fmtLen(s.rg)} · a turn every ${fmtLen(pitchLen)}`, x, y + r * 0.74, { align: 'center', size: 12, color: '#e6ece8' });
      text(c, r > 70 ? `close-up of the spiral · ${scaleNote}` : scaleNote, x, y + r + 12, { align: 'center', size: 11, color: 'rgba(214,224,218,0.7)' });
    }
    function drawPolar(c, x, y, r) {
      const R50 = r, rad = lat => (90 - lat) / 40 * R50;
      c.fillStyle = '#071019'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI); c.fill();
      c.strokeStyle = 'rgba(150,170,255,0.2)'; c.lineWidth = 1;
      for (const lat of [60, 70, 80]) { c.beginPath(); c.arc(x, y, rad(lat), 0, TAU); c.stroke(); }
      c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke();
      // the average oval: about 75° magnetic latitude at noon, 67° at midnight (a ring shifted towards midnight)
      c.strokeStyle = 'rgba(90,255,140,0.09)'; c.lineWidth = rad(64) - rad(70); c.beginPath(); c.arc(x, y + rad(86), rad(71), 0, TAU); c.stroke(); c.lineWidth = 1;
      // where this field line lands
      const lf = Math.acos(Math.sqrt(1 / p.L)) / DEG;
      c.strokeStyle = 'rgba(255,190,90,0.55)'; c.setLineDash([3, 4]); c.beginPath(); c.arc(x, y, rad(lf), 0, TAU); c.stroke(); c.setLineDash([]);
      for (const hh of hits) {
        if (hh.lat < 0) continue;
        const a = clamp(1 - hh.age / (p.mode === 'burst' ? 40 : 80), 0.25, 1), ang = hh.mlt / 24 * TAU, rr = rad(hh.lat / DEG);
        glow(c, x + rr * Math.sin(ang), y + rr * Math.cos(ang), r * (p.mode === 'burst' ? 0.08 : 0.15), colRGB(hh.h), (p.mode === 'burst' ? 0.45 : 0.6) * a);
      }
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      text(c, '12', x, y - r - 8, { size: 10.5, align: 'center', color: 'rgba(255,214,140,0.85)' });
      text(c, '00', x, y + r + 9, { size: 10.5, align: 'center', color: 'rgba(170,190,230,0.85)' });
      text(c, '06', x + r + 4, y, { size: 10.5, color: 'rgba(214,224,218,0.7)' });
      text(c, '18', x - r - 4, y, { size: 10.5, align: 'right', color: 'rgba(214,224,218,0.7)' });
      text(c, '70°', x + rad(70) * 0.7 + 3, y - rad(70) * 0.7, { size: 10, color: 'rgba(150,170,255,0.7)' });
      text(c, 'North Pole from above', x, y - r - 22, { size: 11, align: 'center', color: 'rgba(214,224,218,0.7)' });
      text(c, 'average oval', x - rad(71) * 0.72 - 4, y + rad(86) + rad(71) * 0.72 + 4, { size: 10, align: 'right', color: 'rgba(90,255,140,0.6)' });
    }
    function drawBar(c, x, y, h) {
      // where the light is made: height above the ground, 50 to 300 km
      const w = 12, hmin = 50, hmax = 300, Yk = km => y + h - (km - hmin) / (hmax - hmin) * h;
      const bands = [[50, 85, '120,90,170'], [85, 95, '200,120,255'], [95, 150, '90,255,140'], [150, 200, '210,220,110'], [200, 300, '255,90,80']];
      for (const [a, b, col] of bands) { c.fillStyle = `rgba(${col},0.55)`; c.fillRect(x, Yk(b), w, Yk(a) - Yk(b)); }
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.strokeRect(x + 0.5, y + 0.5, w, h);
      for (const km of [100, 200, 300]) text(c, `${km}`, x + w + 4, Yk(km), { size: 10, color: 'rgba(214,224,218,0.7)' });
      text(c, 'km', x + w + 4, y + h + 9, { size: 10, color: 'rgba(214,224,218,0.6)' });
      const hA = (main.foot ? main.foot.h : R.absorbAlt(sp(), p.keV)) / 1e3, yy = Yk(clamp(hA, hmin, hmax));
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - 2, yy); c.lineTo(x - 9, yy - 5); c.lineTo(x - 9, yy + 5); c.closePath(); c.fill();
    }
    return sim;
  }

  /* =====================================================================
     4. THE LHC — CERN's Large Hadron Collider: the cyclotron's big brother
     ===================================================================== */
  function makeLHC() {
    const L = R.LHC, c0 = R.C.c;
    const BDOT = (R.lhcBeam(L.Edesign).B - R.lhcBeam(L.Einj).B) / 1200;   // T/s: the design ramp, 450 GeV → 7 TeV in 20 minutes
    const T_COLL = 12;                                                   // seconds of collisions shown, always in real time
    const IPS = [[1, 'ATLAS'], [2, 'ALICE'], [5, 'CMS'], [8, 'LHCb']];
    const ang = k => Math.PI / 2 + (k - 1) * Math.PI / 4;               // Point 1 at the bottom, numbered clockwise seen from above
    const p = { E: 6800, k: 1, mode: 'head' };
    let t = 0, phase = 'ready', Etop = 6800, tRamp = 0, sq = 0, tColl = 0, coll = 0, hist = [], rot = 0, evt = null, flashes = [], segMode;
    const rho = () => L.rho * p.k, circ = () => L.circ * p.k;
    const beamAt = E => R.lhcBeam(E, rho());
    const Binj = () => beamAt(L.Einj).B;
    const Emax = () => { const pm = L.Bnom * rho() / R.BRHO; return Math.sqrt(pm * pm + L.mp * L.mp); };
    function Enow() {
      if (phase === 'ready') return L.Einj;
      if (phase !== 'ramp') return Etop;
      const pp = (Binj() + BDOT * t) * rho() / R.BRHO;
      return Math.min(Etop, Math.sqrt(pp * pp + L.mp * L.mp));
    }
    const gainLap = () => rho() * BDOT / R.BRHO * circ() / c0;          // GeV per lap on the ramp: dE/dt ÷ laps per second
    const tev = E => `${pl(E / 1000, 3)} TeV`;
    const gev = E => E >= 1000 ? tev(E) : `${pl(E, 3)} GeV`;
    const kev = G => G >= 1e-3 ? `${pl(G * 1e3, 3)} MeV` : `${pl(G * 1e6, 3)} keV`;
    const betaStr = (b, n) => { const d = n || Math.min(12, Math.ceil(-Math.log10(b.defic)) + 1); return (1 - b.defic).toFixed(d); };
    const capped = () => p.E > Emax() + 1e-6;
    const higgsOK = () => p.mode === 'head' && Etop >= 6500 - 1e-6;
    const sqrtS = E => p.mode === 'head' ? beamAt(E).headOn : beamAt(E).fixed;
    function reset() {
      Etop = Math.min(p.E, Emax());
      t = 0; sq = 0; tColl = 0; coll = 0; evt = null; flashes = []; phase = 'ready';
      tRamp = Math.max(0, (beamAt(Etop).B - Binj()) / BDOT);
      hist = [[0, Binj()]];
    }
    function step(dts, dtr) {
      if (phase === 'ready') { phase = tRamp > 0 ? 'ramp' : 'squeeze'; if (audio.charge) audio.charge(0.5); }
      if (phase === 'ramp') {
        t = Math.min(tRamp, t + dts);
        if (t - hist[hist.length - 1][0] >= tRamp / 240 || t >= tRamp) hist.push([t, beamAt(Enow()).B]);
        if (t >= tRamp) { phase = 'squeeze'; sq = 0; }
        return false;
      }
      if (phase === 'squeeze') { sq += dtr; if (sq >= 2.2) { phase = 'collide'; if (audio.whoosh) audio.whoosh(); } return false; }
      if (phase === 'collide') {
        tColl += dtr; if (p.mode === 'head') coll += L.rate * dtr;
        if (tColl >= T_COLL) { phase = 'done'; return true; }
        return false;
      }
      return true;
    }
    function sideNotes() {
      const n = $('#rsLhcENote');
      if (n) {
        const b = beamAt(Math.min(p.E, Emax()));
        n.innerHTML = capped()
          ? `Too much for this ring: at ${L.Bnom} T, the most the dipoles are built for, it can only hold <b>${gev(Emax())}</b>.`
          : `Needs <b>${pl(b.B, 3)} T</b> in the dipoles (they are built for ${L.Bnom} T). From 2022 to 2026 the LHC ran at 6.8 TeV; it was designed for 7 TeV.`;
      }
      const k = $('#rsLhcKNote'); if (k) k.innerHTML = `Ring ${pl(circ() / 1000, 3)} km round, bending radius ${pl(rho(), 4)} m. The real one is 26.7 km, about 100 m under the French–Swiss border near Geneva.`;
      const m = $('#rsLhcModeNote'); if (m) m.innerHTML = p.mode === 'head' ? 'Two beams meet head-on, like in your Collider station: the total momentum is zero, so all the energy can make new particles.' : 'One beam hits protons that sit still. Momentum must be conserved, so most of the energy is spent pushing the debris forwards.';
    }
    const sim = {
      go: 'Start', speeds: [['1', 'Real time'], ['60', '60× faster'], ['300', '300× faster']], speed0: '60',
      canvasLabel: 'The LHC ring seen from above with its four experiments, the two beams going round in opposite directions, the field in the magnets and, during collisions, a close-up of a collision with curving tracks',
      graphs: ['Field in the dipole magnets during the ramp', 'Field needed for each energy (B = p/qρ)'],
      side() {
        return `<div class="panel"><div class="panel-title">Beam energy</div>
            ${ctl('lhc-e', 'Energy of each proton', 'TeV')}<p class="hint" id="rsLhcENote"></p></div>
          <details class="acc tag-copper" open data-level="expert"><summary><span class="acc-title">What if?</span></summary><div class="acc-body">
            ${ctl('lhc-k', 'Size of the ring', '× LHC')}<p class="hint" id="rsLhcKNote"></p>
            <div class="field-label">How the protons meet</div>
            ${segHTML('lhc-mode', 'How the protons meet', [['head', 'Head-on', 'two beams'], ['fixed', 'Fixed target', 'one beam, still protons']])}<p class="hint" id="rsLhcModeNote"></p></div></details>`;
      },
      bind(changed) {
        range('lhc-e', { min: 0.45, max: 7, step: 0.05, get: () => p.E / 1000, set: v => { p.E = Math.round(v * 1000); changed(); } });
        range('lhc-k', { min: 0.25, max: 1.5, step: 0.05, get: () => p.k, set: v => { p.k = v; changed(); } });
        segMode = segInit($('#rs-lhc-mode'), () => p.mode, v => { p.mode = v; changed(); });
      },
      reset() { reset(); sideNotes(); },
      step,
      draw(c, W, H, dtr, running) { drawLHC(c, W, H, dtr, running); },
      home3d: { yaw: -Math.PI / 2 - 0.18, pitch: 0.4, dist: 15, target: [0, 0, 0], fov: 46, minDist: 0.6, maxDist: 160 },
      draw3d(sc, c, W, H, dtr, running) { drawLHC3d(sc, c, W, H, dtr, running); },
      speedApplies: () => phase === 'ready' || phase === 'ramp',
      clock: () => phase === 'ready' ? 'ramp 0:00' : phase === 'ramp' ? `ramp ${mmss(t)} of ${mmss(tRamp)}` : phase === 'squeeze' ? `ramp done after ${mmss(tRamp)}` : `colliding · ${pl(tColl, 2)} s in real time`,
      status() {
        const E = Enow();
        if (phase === 'ready') return capped() ? [`This ring tops out at ${gev(Emax())}`, 'is-warn'] : ['Beams in at 450 GeV, ready to ramp', ''];
        if (phase === 'ramp') return [`Ramping · ${gev(E)} · ${pl(beamAt(E).B, 3)} T`, 'is-run'];
        if (phase === 'squeeze') return ['Squeezing the beams together', 'is-run'];
        if (phase === 'collide') return p.mode === 'head' ? [`Colliding at ${tev(2 * Etop)}`, 'is-good'] : [`Fixed target: only ${gev(beamAt(Etop).fixed)}`, 'is-warn'];
        return ['Done: in reality the beams would collide for 10 to 15 hours', 'is-good'];
      },
      narrate() {
        const E = Enow(), b = beamAt(E), g = gainLap(), lab = labNow(), sm = simple();
        const yours = lab ? ` Your cyclotron’s dees give ${en(lab.gain)} per turn.` : '';
        if (phase === 'ready') {
          if (sm) return `The LHC is a ring ${p.k === 1 ? '27' : pl(circ() / 1000, 2)} km round. Protons race round it in two beams that go opposite ways. In your cyclotron the magnet stays the same and the circle grows; here the circle can’t grow, so as the protons gain energy the <b>magnets must get stronger</b> to keep them on the ring. Press <b>Start</b>.${capped() ? ` This ring is too small for ${tev(p.E)}: it tops out at ${gev(Emax())}.` : ''}`;
          return `Two beams of protons, each about 2,500 bunches, already circle the ${pl(circ() / 1000, 3)} km ring in opposite directions at the injection energy of 450 GeV. To keep them on a bend of radius ρ = ${pl(rho(), 4)} m the ${p.k === 1 ? '1,232 ' : ''}dipole magnets need <b>B = p/(qρ) = ${pl(b.B, 3)} T</b>: your cyclotron’s r = p/(qB), solved for B. Press <b>Start</b> to ramp to ${gev(Etop)}.${capped() ? ` (You asked for ${tev(p.E)}, but at ${L.Bnom} T this ring can hold only ${gev(Emax())}.)` : ''}`;
        }
        if (phase === 'ramp') {
          if (sm) return `Speeding up. Every lap the protons get a small push of about <b>${kev(g)}</b>.${yours} To keep them on the same circle the magnets get stronger: <b>${pl(b.B, 3)} T</b> now. Their speed hardly changes (only ${pl(b.slower, 3)} m/s below the speed of light), but their energy keeps growing: near the speed of light, extra energy makes them harder to bend rather than much faster.`;
          return `Ramping: on each lap the 8 RF cavities of each beam give every proton about <b>${kev(g)}</b>, and the current in the dipoles rises at a steady rate, so B = p/(qρ) keeps pace: <b>${pl(b.B, 3)} T</b> now.${yours} The speed hardly changes: ${pl(b.slower, 3)} m/s below c, ${pl(b.frev, 6)} laps a second. The energy grows because γ = E/mc² grows (${pl(b.gam, 4)} now).`;
        }
        if (phase === 'squeeze') return sm ? 'Ramp done. Now special magnets near the experiments squeeze the beams thinner and steer them into each other.' : `At ${gev(Etop)} the ramp is over (${mmss(tRamp)} in real time). Focusing magnets near the experiments now squeeze the beams to make collisions more likely, and the beams are steered into each other at four points.`;
        if (p.mode === 'fixed') {
          const fx = beamAt(Etop).fixed;
          return sm ? `One beam hits protons that stand still. The collision only gets <b>${gev(fx)}</b>: most of the energy just pushes the pieces forwards. That is less than the 125 GeV needed for a Higgs boson, so it can’t make one. Head-on, the same beams would give ${tev(2 * Etop)}.` : `Fixed target: a ${gev(Etop)} proton hits a proton at rest. Momentum must be conserved, so the debris keeps moving forwards and only √s = √(2(mc²)² + 2E·mc²) = <b>${gev(fx)}</b> is free to make new particles: less than the Higgs boson’s 125 GeV. Head-on beams give √s = 2E = ${tev(2 * Etop)}. That is why the LHC is a collider.`;
        }
        const h = higgsOK() ? ` About one collision in a billion makes a Higgs boson: about <b>${pl(coll * L.higgs, 2)}</b> so far.` : ' The “one Higgs boson in a billion collisions” figure is for the full 13.6 TeV.';
        if (phase === 'collide') return sm ? `Colliding! The beams meet head-on at ATLAS, CMS, ALICE and LHCb with <b>${tev(2 * Etop)}</b>. In ATLAS and CMS there are about 1.5 billion collisions every second.${h} In the detectors the new particles curve in a magnetic field: r = p/(qB) again.` : `Stable beams. Head-on, the collision energy is √s = 2E = <b>${tev(2 * Etop)}</b>. At the real LHC’s settings ATLAS and CMS see about 1.5 billion collisions a second.${h} Inside the detectors a magnet bends every charged track, r = p/(qB), so its curve gives its momentum.`;
        return `In ${T_COLL} s about <b>${pl(coll, 3)}</b> collisions happened in ATLAS and CMS${higgsOK() ? `, and about ${pl(coll * L.higgs, 2)} Higgs bosons were made` : ''}. A real fill collides for 10 to 15 hours before the beams are dumped and the machine starts again at 450 GeV.`;
      },
      tiles() {
        const E = Enow(), b = beamAt(E);
        return [
          ['Field in the magnets', `${pl(b.B, 3)} T`, `B = p/(qρ) · built for ${L.Bnom} T`],
          ['Speed', `c − ${pl(b.slower, 3)} m/s`, `${betaStr(b)} c · γ = ${pl(b.gam, 4)}`],
          ['Laps per second', pl(b.frev, 6), `f = v/C · ring ${pl(circ() / 1000, 3)} km`],
          [p.mode === 'head' ? 'Collision energy' : 'Collision energy (fixed target)', gev(sqrtS(E)), p.mode === 'head' ? `head-on: 2 × ${gev(E)}` : `head-on would give ${gev(b.headOn)}`],
        ];
      },
      graphA(cv) {
        const tMax = Math.max(tRamp, 60) * 1.04, Bt = beamAt(Etop).B;
        const r = plot(cv, { xmin: 0, xmax: tMax, xf: 60, ymin: 0, ymax: 10, xlabel: 'time on the ramp (min)', ylabel: 'field B (T)', pad: { r: 16 },
          series: [{ pts: [[0, Binj()], [tRamp, Bt]], color: 'rgba(210,220,214,0.45)', width: 1.3, dash: [4, 4] }, { pts: hist, color: lamp(), width: 2.4, dot: phase === 'ramp' }] });
        if (!r) return;
        const c = r.ctx;
        for (const [v, tx] of [[L.Bnom, `built for ${L.Bnom} T`], [L.Bult, 'about 9 T at most']]) { const y = Math.round(r.YP(v)) + 0.5; c.strokeStyle = 'rgba(255,210,120,0.3)'; c.setLineDash([2, 5]); c.lineWidth = 1; c.beginPath(); c.moveTo(r.pad.l, y); c.lineTo(r.W - r.pad.r, y); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,214,140,0.8)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'right'; c.textBaseline = v === L.Bult ? 'bottom' : 'top'; c.fillText(tx, r.W - r.pad.r - 4, v === L.Bult ? y - 2 : y + 2); }
        c.fillStyle = 'rgba(210,220,214,0.6)'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('dashed: the whole ramp, planned in advance', r.pad.l + 6, r.pad.t + 18);
      },
      graphB(cv) {
        const yMax = 12, line = rh => { const a = []; for (let i = 0; i <= 80; i++) { const E = L.Einj + (7000 - L.Einj) * i / 80, B = R.lhcBeam(E, rh).B; if (B > yMax) break; a.push([E / 1000, B]); } return a; };
        const series = [{ pts: line(L.rho), color: '#5cc8ff', width: 2.2 }];
        if (Math.abs(p.k - 1) > 1e-9) series.push({ pts: line(rho()), color: lamp(), width: 2.2 });
        const r = plot(cv, { xmin: 0, xmax: 7.2, ymin: 0, ymax: yMax, xlabel: 'energy of each proton (TeV)', ylabel: 'field needed (T)', pad: { r: 16 }, series });
        if (!r) return;
        const c = r.ctx;
        for (const [v, tx] of [[L.Bnom, 'built for 8.33 T'], [L.Bult, 'about 9 T at most']]) { const y = Math.round(r.YP(v)) + 0.5; c.strokeStyle = 'rgba(255,210,120,0.3)'; c.setLineDash([2, 5]); c.beginPath(); c.moveTo(r.pad.l, y); c.lineTo(r.W - r.pad.r, y); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,214,140,0.8)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'left'; c.textBaseline = v === L.Bult ? 'bottom' : 'top'; c.fillText(tx, r.pad.l + 6, v === L.Bult ? y - 2 : y + 2); }
        c.font = '600 11px "Barlow", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'bottom';
        c.fillStyle = '#5cc8ff'; c.fillText('the real LHC ring', r.W - r.pad.r - 4, r.YP(R.lhcBeam(7000).B) - 16);
        if (series.length > 1) { const last = series[1].pts[series[1].pts.length - 1]; c.fillStyle = lamp(); c.fillText('your ring', r.XP(last[0]) - 4, r.YP(last[1]) - 6); }
        const E = Enow(), b = beamAt(E);
        if (b.B <= yMax) { c.fillStyle = '#fff'; c.strokeStyle = lamp(); c.lineWidth = 2; c.beginPath(); c.arc(r.XP(E / 1000), r.YP(b.B), 4.5, 0, TAU); c.fill(); c.stroke(); }
      },
      numbers() {
        const E = Enow(), b = beamAt(E), lab = labNow(), g = gainLap();
        const pmax = L.Bnom * rho() / R.BRHO, sci = x => CL.fmt.sci(x, 4);
        let h = sec('The protons');
        h += row('Energy of each proton', gev(E), 'Total energy E = γmc². The beams come in at 450 GeV and are ramped up.', `E = ${pl(E, 6)} GeV; rest energy mc² = ${L.mp.toFixed(4)} GeV`);
        h += row('Lorentz factor γ', pl(b.gam, 5), 'How many times its rest energy each proton carries.', `γ = E/mc² = ${pl(E, 6)} / ${L.mp.toFixed(4)} = ${pl(b.gam, 5)}`);
        h += row('Momentum', `${pl(b.p, 6)} GeV/c`, 'Almost equal to E/c this close to the speed of light.', `p = √(E² − (mc²)²)/c = √(${pl(E, 6)}² − ${L.mp.toFixed(4)}²) = ${pl(b.p, 7)} GeV/c`);
        h += row('Speed', `c − ${pl(b.slower, 3)} m/s`, `v = ${betaStr(b)} c. More energy hardly changes the speed any more.`, `1 − β = 1/(γ²(1 + β)) = ${sci(b.defic)}, so c − v = c(1 − β) = ${pl(b.slower, 3)} m/s`);
        h += sec('Holding them on the ring');
        h += row('Bending radius ρ', `${pl(rho(), 5)} m`, `Only the 1,232 dipole magnets bend the beam. Together they turn it through a full circle of radius ρ (2πρ = ${pl(2 * Math.PI * rho() / 1000, 3)} km of bending); the rest of the ${pl(circ() / 1000, 3)} km ring is straight sections and focusing magnets.${p.k !== 1 ? ` Here ${pl(p.k, 3)} × the real 2,803.95 m.` : ''}`, '');
        h += row('Field needed', `${pl(b.B, 4)} T`, 'Your cyclotron’s r = p/(qB), solved for B. 1 GeV/c of momentum per elementary charge needs B·ρ = 3.3356 T·m.', `B = p/(qρ) = ${pl(b.p, 6)} × 3.3356 T·m ÷ ${pl(rho(), 5)} m = ${pl(b.B, 4)} T`);
        h += row('Highest energy this ring can hold', gev(Emax()), `With the dipoles at ${L.Bnom} T, the field they are built for (about 9 T is the most they can take).`, `p = qρB = ${pl(rho(), 5)} m × ${L.Bnom} T ÷ 3.3356 T·m = ${pl(pmax, 5)} GeV/c`);
        h += row('Laps per second', pl(b.frev, 6), 'f = v/C, with C the length of the ring.', `f = ${pl(b.beta * c0, 9)} m/s ÷ ${pl(circ(), 6)} m = ${pl(b.frev, 6)} Hz`);
        h += sec('Speeding them up');
        h += row('Energy gained per lap on the ramp', kev(g), `About as much as your cyclotron gives per turn${lab ? ` (${en(lab.gain)})` : ''}. The LHC simply keeps pushing, lap after lap, for millions of laps.`, `dE/dt = (ρ/3.3356)·dB/dt·c = ${pl(rho() * BDOT / R.BRHO, 4)} GeV/s; ÷ ${pl(b.frev, 6)} laps/s = ${kev(g)} per lap`);
        h += row('Time for the ramp', mmss(tRamp), 'The current in the dipoles rises at a steady rate. In the design the ramp from 450 GeV to 7 TeV takes 20 minutes.', `t = (B<sub>top</sub> − B<sub>inj</sub>) ÷ dB/dt = (${pl(beamAt(Etop).B, 4)} − ${pl(Binj(), 4)}) T ÷ ${pl(BDOT * 1000, 3)} mT/s = ${pl(tRamp, 4)} s`);
        h += row('RF cavities', '8 per beam, 2 MV each', 'Up to 16 MeV per lap if a proton crossed them all at the peak voltage, but on the ramp each proton only needs the energy that matches the rising field. Like your dees, they push at the right moment of their 400 MHz oscillation.', '');
        h += sec('Collisions');
        h += row('Collision energy, head-on', tev(b.headOn), 'Equal and opposite momenta add up to zero, so all of 2E can turn into new particles.', `√s = 2E = 2 × ${gev(E)} = ${tev(b.headOn)}`);
        h += row('Collision energy, fixed target', gev(b.fixed), 'One proton at rest: momentum must be conserved, so most of the energy goes into moving the debris forwards.', `√s = √(2(mc²)² + 2E·mc²) = √(2 × ${L.mp.toFixed(4)}² + 2 × ${pl(E, 6)} × ${L.mp.toFixed(4)}) = ${pl(b.fixed, 4)} GeV`);
        h += row('Collisions per second', '1.5 billion', 'In ATLAS and CMS at the real LHC’s settings. About one in a billion makes a Higgs boson (mass 125 GeV/c²), so about 1.5 a second.', '');
        const N = 2500 * 1.6e11, Ej = N * E * 1e9 * R.C.e, vt = Math.sqrt(2 * Ej / 4e5);
        h += row('Energy in one beam', si(Ej, 'J', 3), 'About 2,500 bunches of 1.6 × 10¹¹ protons at the start of a fill.', `2,500 × 1.6 × 10¹¹ × ${gev(E)} = ${si(Ej, 'J', 3)}: the kinetic energy of a 400 t train at ${pl(vt * 3.6, 3)} km/h`);
        if (lab) {
          h += sec('Your cyclotron, scaled up');
          const rc = b.cycR(lab.B), fz = lab.fc / b.gam;
          h += row(`A cyclotron for ${gev(E)} with your magnet`, `radius ${fmtLenS(rc)}`, `With your field of ${fmtB(lab.B)} it would need dees ${fmtLenS(rc)} across in radius. Worse: at γ = ${pl(b.gam, 4)} a proton circles γ times more slowly than at rest (f = qB/2πγm), so a fixed-frequency cyclotron would fall out of step long before.`, `r = p/(qB) = ${pl(b.p, 6)} × 3.3356 T·m ÷ ${pl(lab.B, 4)} T = ${fmtLenS(rc)}; f = ${si(lab.fc, 'Hz', 3)} ÷ ${pl(b.gam, 4)} = ${si(fz, 'Hz', 3)}`);
        }
        return h;
      },
      keyNumbers() {
        const E = Enow(), b = beamAt(E), lab = labNow(), g = gainLap();
        return row('Field the magnets need', `${pl(b.B, 3)} T`, `B = p/(qr): the bigger the momentum, the stronger the field must be to keep the same circle. At 450 GeV it is only ${pl(Binj(), 3)} T.`)
          + row('Speed', `c − ${pl(b.slower, 3)} m/s`, `Only ${pl(b.slower, 3)} m/s slower than light. Extra energy hardly adds speed any more.`)
          + row('Laps per second', pl(b.frev, 5), 'Every proton goes round the 27 km ring this many times every second.')
          + row('Push per lap', kev(g), `${lab ? `Your cyclotron gives ${en(lab.gain)} per turn: about the same! ` : ''}The LHC just keeps pushing, for millions of laps.`)
          + row('Collision energy', gev(sqrtS(E)), p.mode === 'head' ? 'Two beams head-on: the two energies add up.' : 'Fixed target: most of the energy is lost to pushing the pieces forwards.');
      },
      check() {
        const a = R.lhcBeam(450), z = R.lhcBeam(7000), r68 = R.lhcBeam(6800), g7 = L.rho * BDOT / R.BRHO * L.circ / c0;
        const ok = (x, y, tol) => Math.abs(x - y) <= tol * Math.abs(y) ? 'good' : 'warn';
        let h = '<p class="hint">The model is only r = p/(qB), E = γmc² and v = f·C. Here it is run for the real ring and compared with CERN’s published numbers.</p>';
        h += cmpTable([
          ['Field at injection, 450 GeV', `${pl(a.B, 4)} T`, '0.535 T', 'lhcdr', ok(a.B, 0.535, 0.002)],
          ['Field at 7 TeV', `${pl(z.B, 4)} T`, '8.33 T', 'lhcdr', ok(z.B, 8.33, 0.002)],
          ['Speed at 450 GeV', `${betaStr(a, 9)} c`, '0.999997828 c', 'cernfaq', ok(1 - a.defic, 0.999997828, 1e-8)],
          ['Speed at 7 TeV', `${betaStr(z, 9)} c`, '0.999999991 c', 'cernfaq', ok(1 - z.defic, 0.999999991, 1e-9)],
          ['Laps per second at 6.8 TeV', pl(r68.frev, 6), '11,245', 'cernfacts', ok(r68.frev, 11245, 1e-4)],
          ['Collision energy at 6.8 TeV', tev(r68.headOn), '13.6 TeV', 'cernfacts', ok(r68.headOn, 13600, 1e-4)],
          ['Energy gained per lap, 20-minute ramp to 7 TeV', kev(g7), '485 keV', 'synch', ok(g7 * 1e6, 485, 0.01)],
          ['Bending radius, dipoles', `${pl(L.rho, 6)} m`, '2,803.95 m (input)', 'lhcdr'],
        ]);
        h += '<p class="hint">At 450 GeV the model gives 0.99999782<b>6</b> c and CERN 0.99999782<b>8</b> c: CERN rounded the proton’s rest energy to 0.938 GeV. The rest agree to every digit published.</p>';
        return h;
      },
      sources: ['cernfacts', 'cernhours', 'lhcdr', 'lhcmo', 'cernfaq', 'bruning', 'synch', 'losses', 'juas', 'higgs', 'dipole'],
      whySources: ['cmsmass', 'cernhf', 'cernweb', 'therapy', 'medipix', 'mri'],
      get without() { return p.mode === 'fixed'; },
      setWithout(b) { p.mode = b ? 'fixed' : 'head'; if (segMode) segMode.sync(); },
      why(sm) {
        const b = beamAt(Etop), fx = b.fixed, hd = b.headOn, fixedOn = p.mode === 'fixed';
        return {
          q: 'Why build a 27 km ring to smash protons?',
          a: sm ? 'To find out what everything is made of. In 2012 the LHC found the <b>Higgs boson</b>, the sign of the field that gives electrons their mass. Without that field electrons would have no mass, and atoms could not form. To make one, the protons must meet head-on: a beam that hits protons standing still wastes almost all its energy pushing the pieces forwards.'
            : 'To test what matter is made of. The Higgs boson (125 GeV/c²), found by ATLAS and CMS in 2012, is the sign of the field that gives electrons and quarks their mass; without it electrons would be massless and atoms could not form. Only energy in the centre-of-mass frame can make new particles: head-on √s = 2E, but on a fixed target √s ≈ √(2E·mc²), far below the Higgs mass.',
          metric: 'Energy free to make new particles',
          mark: { v: 125, label: 'a Higgs boson needs 125 GeV' },
          pick: true,
          rows: [
            { k: 'off', label: 'One beam on protons standing still', v: fx, txt: `${gev(fx)}: no Higgs`, cur: fixedOn },
            { k: 'on', label: 'Two beams head-on', v: hd, txt: `${gev(hd)}: ${Etop >= 6500 - 1e-6 ? 'about 1.5 Higgs a second' : 'Higgs bosons possible'}`, cur: !fixedOn },
          ],
          verdict: 'And what particle physicists built along the way now helps everyone: the Web, particle-beam cancer therapy, colour X-rays and the wire in MRI magnets.',
        };
      },
      helps() {
        return [
          ['star', 'Why atoms exist', 'The Higgs field gives electrons their mass; with massless electrons, atoms could not form. (Most of your own mass comes from the strong force inside protons.)', 'cmsmass'],
          ['web', 'Everyone online', 'The World Wide Web was invented at CERN in 1989 so that physicists could share their data.', 'cernweb'],
          ['beam', 'Cancer patients', 'CERN’s PIMMS design became the CNAO and MedAustron ion-beam cancer centres; particle-beam therapy has helped cure more than 260,000 patients.', 'therapy'],
          ['scan', 'Colour X-rays', 'Medipix chips, first developed to track particles at the LHC, made the first 3D colour X-ray of a person possible in 2018.', 'medipix'],
          ['magnet', 'MRI scans', 'Building superconducting magnets for colliders set up the wire industry that hospital MRI scanners rely on.', 'mri'],
        ];
      },
      link(sm) {
        const lab = labNow(), b = beamAt(Etop), bi = beamAt(L.Einj);
        const rows = [
          ['Path', 'a spiral that grows each turn', `one ring, ${pl(circ() / 1000, 3)} km round`],
          ['Magnetic field', lab ? `${fmtB(lab.B)}, always the same` : 'always the same', `${pl(bi.B, 3)} T at the start, rising to ${pl(b.B, 3)} T`],
          ['Push each lap', lab ? `${en(lab.gain)} (two gaps)` : 'two gaps per turn', `about ${kev(gainLap())} (8 cavities per beam)`],
          ['Top energy', lab ? en(lab.Kmax) : '–', `${gev(Etop)} per proton`],
          ['Top speed', lab ? `${pl(lab.vmax / c0 * 100, 3)} % of light` : '–', `${pl(b.slower, 3)} m/s below light`],
        ];
        if (!sm) rows.push(
          ['Laps per second', lab ? si(lab.fc, 'Hz', 3) : '–', `${pl(b.frev, 6)} Hz: already almost at c, so it hardly changes`],
          [`A cyclotron for ${gev(Etop)}`, lab ? `with your ${fmtB(lab.B)}: dees ${fmtLenS(b.cycR(lab.B))} in radius` : '–', `bends at ρ = ${pl(rho(), 4)} m with ${pl(b.B, 3)} T`],
          ['Collisions', 'your Collider station: two beams head-on', `four crossing points, ${tev(2 * Etop)} head-on`]);
        return {
          title: 'How is the LHC the cyclotron’s big brother?',
          text: sm ? 'Both bend protons with the same rule, <b>r = p/(qB)</b>, and both push them with an electric field once every turn. Your cyclotron keeps B fixed, so the circle grows as the proton speeds up. The LHC can’t grow, it is a 27 km tunnel, so it <b>raises B</b> as the momentum grows. And it is a real <b>collider</b>: two beams going opposite ways meet head-on, just like in your Collider station.'
            : 'Same physics, opposite strategy. A cyclotron keeps B fixed and lets r = p/(qB) grow; the LHC is a <b>synchrotron</b>: it keeps r fixed and raises B in step with p. Its RF still pushes once per lap, like your dees, and the push per lap is about the same size; the LHC just keeps going for millions of laps. A cyclotron couldn’t do this: at γ in the thousands the proton circles γ times more slowly (f = qB/2πγm), so fixed-frequency dees would lose step. Head-on collisions then turn all of 2E into new particles.',
          cols: ['Your cyclotron', 'The LHC'], rows, alt: 'Animation: on the left your cyclotron’s spiral, which grows at a fixed field; on the right the LHC ring, which stays the same size while its field grows', draw: drawLinkLHC,
        };
      },
    };

    /* ---- the drawing: the ring from above, the field gauges, the collisions ---- */
    function layout(W, H) {
      if (W < 600) {
        const top = 56, bottom = 100, R0 = Math.max(56, Math.min(W * 0.34, (H - top - bottom - 44) / 2));
        return { narrow: true, cx: W / 2, cy: top + 24 + R0, R0, gx: 16, gy: H - bottom + 18, gw: W - 32 };
      }
      const R0 = Math.min(W * 0.26, H * 0.38), cx = 40 + R0 + 46, gx = cx + R0 + 80;
      return { narrow: false, cx, cy: H * 0.52, R0, gx, gy: Math.max(64, H * 0.2), gw: Math.min(420, W - gx - 20) };
    }
    function bar(c, x, y, w, label, val, f, marks, rgb) {
      text(c, label, x, y, { size: 12.5, color: 'rgba(214,224,218,0.82)' });
      text(c, val, x + w, y, { size: 16, align: 'right', color: '#fff' });
      const by = y + 13, bh = 10;
      c.fillStyle = 'rgba(255,255,255,0.08)'; rrect(c, x, by, w, bh, 5); c.fill();
      const fw = Math.max(bh, w * clamp(f, 0, 1));
      const gr = c.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, `rgba(${rgb},0.55)`); gr.addColorStop(1, `rgba(${rgb},1)`);
      c.fillStyle = gr; rrect(c, x, by, fw, bh, 5); c.fill();
      for (const [mf, ml, al] of marks) { const mx = x + w * mf; c.fillStyle = 'rgba(255,214,140,0.9)'; c.fillRect(Math.round(mx) - 0.5, by - 3, 1, bh + 6); if (ml) text(c, ml, mx + (al === 'right' ? 3 : al === 'left' ? -3 : 0), by + bh + 10, { size: 10.5, align: al === 'right' ? 'left' : al === 'left' ? 'right' : 'center', color: 'rgba(255,214,140,0.85)' }); }
    }
    function newEvent() {
      const fixed = p.mode === 'fixed', n = fixed ? 12 : 10 + Math.floor(Math.random() * 7), tr = [];
      for (let i = 0; i < n; i++) {
        const pt = Math.exp(Math.log(0.35) + Math.random() * Math.log(10 / 0.35));   // GeV/c, spread like real events: mostly soft
        tr.push({ phi: fixed ? (Math.random() - 0.5) * 0.7 : Math.random() * TAU, rm: pt / (0.3 * 3.8), q: Math.random() < 0.5 ? 1 : -1, hue: Math.random() < 0.5 ? 190 : 30 });
      }
      return { tr, age: 0 };
    }
    function drawEvent(c, x0, y0, ri, e) {
      const grow = clamp(e.age / 0.3, 0, 1), fade = clamp(1 - (e.age - 0.45) / 0.5, 0, 1);
      if (fade <= 0) return;
      const sc = ri / 1.25;                                          // pixels per metre: the inset is about 2.5 m across
      for (const k of e.tr) {
        const rp = k.rm * sc, ds = Math.max(1.2, ri / 40);
        let x = x0, y = y0, a = k.phi, s = 0;
        const sMax = Math.min(TAU * rp, ri * 2.4) * grow;
        c.strokeStyle = `hsla(${k.hue},95%,65%,${0.9 * fade})`; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y);
        while (s < sMax) { a += k.q * ds / rp; x += Math.cos(a) * ds; y += Math.sin(a) * ds; s += ds; if (Math.hypot(x - x0, y - y0) > ri - 2) break; c.lineTo(x, y); }
        c.stroke();
      }
      glow(c, x0, y0, 10 * fade, '255,250,220', 0.9 * fade);
    }
    // the land above the ring at night, roughly as it lies: the Jura mountains beyond CMS (north-west), Geneva and its
    // lake beyond ATLAS (south-east), fields and villages in between. Painted once per size and kept.
    let mapCache = null;
    function drawNightMap(c, W, H, cx, cy, R0, narrow) {
      const key = [W, H, Math.round(cx), Math.round(cy), Math.round(R0)].join();
      if (!mapCache || mapCache.key !== key) {
        const cv = document.createElement('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
        const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const base = g.createLinearGradient(0, 0, 0, H); base.addColorStop(0, '#0a100f'); base.addColorStop(1, '#070a0b'); g.fillStyle = base; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 70; i++) {                         // fields and woods
          const x = hash(i + 11) * W, y = hash(i + 22) * H, r = (0.15 + 0.5 * hash(i + 33)) * R0, dark = hash(i + 44) > 0.5;
          const fg = g.createRadialGradient(x, y, 0, x, y, r); fg.addColorStop(0, dark ? 'rgba(4,10,8,0.55)' : 'rgba(30,44,34,0.35)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = fg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
        }
        // the Jura: a long ridge across the top, beyond Point 5
        g.save(); g.translate(cx, cy - R0 * 1.75); g.rotate(-0.12);
        for (let k = 0; k < 3; k++) {
          const jg = g.createLinearGradient(0, -R0 * (0.35 - k * 0.08), 0, R0 * 0.3); jg.addColorStop(0, 'rgba(0,0,0,0)'); jg.addColorStop(0.5, `rgba(${28 + 8 * k},${34 + 8 * k},${40 + 6 * k},0.55)`); jg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = jg; g.beginPath(); g.moveTo(-W, R0 * 0.3); for (let x = -W; x <= W; x += 40) g.lineTo(x, -R0 * (0.12 + 0.1 * hash(Math.round(x / 40) + 90 + k * 7)) + k * R0 * 0.1); g.lineTo(W, R0 * 0.3); g.closePath(); g.fill();
        }
        g.restore();
        // Lake Geneva, beyond Point 1 to the south-east, and the city on its tip
        const lx = cx + R0 * 1.35, ly = cy + R0 * 1.55;
        g.save(); g.translate(lx, ly); g.rotate(-0.42);
        const lg = g.createLinearGradient(0, -R0 * 0.3, 0, R0 * 0.3); lg.addColorStop(0, '#0d1c2e'); lg.addColorStop(1, '#081422');
        g.fillStyle = lg; g.beginPath(); g.ellipse(R0 * 1.4, 0, R0 * 1.55, R0 * 0.32, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(140,180,220,0.18)'; g.lineWidth = 1; g.stroke();
        g.restore();
        const lights = (x0, y0, n, spread, warm) => { for (let i = 0; i < n; i++) { const a = hash(i * 3 + x0) * TAU, r = Math.pow(hash(i * 7 + y0), 0.7) * spread, x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r * 0.8, b = hash(i + x0 + y0); g.fillStyle = warm ? `rgba(255,${190 + 40 * b},${110 + 60 * b},${0.35 + 0.5 * b})` : `rgba(210,225,255,${0.25 + 0.4 * b})`; g.fillRect(x, y, b > 0.85 ? 1.8 : 1.1, b > 0.85 ? 1.8 : 1.1); } };
        lights(Math.round(lx - R0 * 0.05), Math.round(ly - R0 * 0.1), 420, R0 * 0.55, true);            // Geneva
        lights(Math.round(cx + R0 * 0.12), Math.round(cy + R0 * 1.12), 110, R0 * 0.2, true);            // Meyrin, by CERN
        for (let v = 0; v < 14; v++) lights(Math.round(hash(v + 70) * W), Math.round(hash(v + 80) * H), 22, R0 * 0.07, hash(v + 90) > 0.3);   // villages
        const glowG = g.createRadialGradient(lx, ly, 0, lx, ly, R0 * 1.1); glowG.addColorStop(0, 'rgba(255,170,90,0.12)'); glowG.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = glowG; g.fillRect(0, 0, W, H);
        const lab = (t, x, y, col) => { if (x > 12 && x < W - 12 && y > 50 && y < H - 12) CL.haloText(g, t, x, y, { font: F(narrow ? 11 : 12.5, 600), align: 'center', base: 'middle', color: col, halo: 3, haloColor: 'rgba(4,7,9,0.85)' }); };
        lab('Jura mountains', cx - R0 * 0.2, cy - R0 * 1.62, 'rgba(190,200,210,0.6)');
        lab('France', cx - R0 * 1.05, cy - R0 * 0.55, 'rgba(190,200,210,0.45)');
        lab('Geneva', lx - R0 * 0.1, ly - R0 * 0.45, 'rgba(255,214,140,0.75)');
        lab('Switzerland', lx + R0 * 0.55, ly - R0 * 0.85, 'rgba(190,200,210,0.45)');
        mapCache = { key, cv };
      }
      c.drawImage(mapCache.cv, 0, 0, W, H);
    }
    function drawLHC(c, W, H, dtr, running) {
      const G = layout(W, H), { cx, cy, R0 } = G, E = Enow(), b = beamAt(E), Bf = clamp(b.B / L.Bnom, 0, 1.2);
      const live = phase !== 'done', moving = running || phase === 'ready';
      if (moving && live) rot += dtr * TAU * 0.112455;                       // drawn 100,000 times slower than real
      drawNightMap(c, W, H, cx, cy, R0, G.narrow);
      // ring size: the real LHC is dashed if the ring was changed
      const kd = Math.max(1, p.k), Rr = R0 * p.k / kd;
      if (Math.abs(p.k - 1) > 1e-9) { c.strokeStyle = 'rgba(120,200,255,0.35)'; c.setLineDash([5, 6]); c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cy, R0 / kd, 0, TAU); c.stroke(); c.setLineDash([]); text(c, 'real LHC', cx + R0 / kd * 0.72, cy - R0 / kd * 0.72 - 8, { size: 10.5, color: 'rgba(150,210,255,0.8)', align: 'center' }); }
      // tunnel, then the eight arcs of dipoles, glowing with their field
      c.strokeStyle = '#121a1f'; c.lineWidth = 12; c.beginPath(); c.arc(cx, cy, Rr, 0, TAU); c.stroke();
      c.save(); c.shadowColor = `rgba(255,170,60,${0.25 + 0.55 * Bf})`; c.shadowBlur = 6 + 14 * Bf;
      c.strokeStyle = `rgba(255,${Math.round(150 + 80 * Math.min(1, Bf))},${Math.round(60 + 110 * Math.min(1, Bf))},${0.22 + 0.7 * Math.min(1, Bf)})`; c.lineWidth = 5;
      for (let k = 1; k <= 8; k++) { c.beginPath(); c.arc(cx, cy, Rr, ang(k) + 0.1, ang(k) + Math.PI / 4 - 0.1); c.stroke(); }
      c.restore();
      // the two beam pipes and their bunches: beam 1 clockwise (blue), beam 2 anticlockwise (red)
      const r1 = Rr + 2.4, r2 = Rr - 2.4;
      c.strokeStyle = 'rgba(160,190,210,0.25)'; c.lineWidth = 1; for (const rr of [r1, r2]) { c.beginPath(); c.arc(cx, cy, rr, 0, TAU); c.stroke(); }
      if (live) {
        const n = 64, fill = 54;
        for (const [rr, dir, rgb, show] of [[r1, 1, '120,200,255', true], [r2, -1, '255,128,110', p.mode === 'head']]) {
          if (!show) continue;
          for (let i = 0; i < fill; i++) { const a = dir * rot + i * TAU / n + (dir < 0 ? 0.37 : 0); const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a); glow(c, x, y, 3.2, rgb, 0.8); }
        }
      }
      // the eight points: experiments at 1, 2, 5 and 8; the RF cavities at 4
      for (let k = 1; k <= 8; k++) { const a = ang(k); c.strokeStyle = 'rgba(214,224,218,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx + (Rr - 8) * Math.cos(a), cy + (Rr - 8) * Math.sin(a)); c.lineTo(cx + (Rr + 8) * Math.cos(a), cy + (Rr + 8) * Math.sin(a)); c.stroke(); }
      const lab = (k, s, col, size) => { const a = ang(k), ca = Math.cos(a), sa = Math.sin(a), rr = Rr + 16 + (Math.abs(ca) < 0.3 ? 4 : 0); text(c, s, cx + rr * ca, cy + rr * sa + (sa > 0.3 ? 4 : sa < -0.3 ? -4 : 0), { size, color: col, align: ca > 0.3 ? 'left' : ca < -0.3 ? 'right' : 'center' }); };
      for (const [k, s] of IPS) {
        const a = ang(k), x = cx + Rr * Math.cos(a), y = cy + Rr * Math.sin(a);
        c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = '#26323a'; c.strokeStyle = 'rgba(214,224,218,0.55)'; c.lineWidth = 1; rrect(c, -7, -6, 14, 12, 2.5); c.fill(); c.stroke(); c.restore();
        lab(k, s, '#e6ece8', G.narrow ? 11.5 : 12.5);
      }
      lab(4, G.narrow ? 'RF' : 'RF cavities', 'rgba(255,214,140,0.85)', 11);
      if (phase === 'ramp' && running) { const a = ang(4); glow(c, cx + Rr * Math.cos(a), cy + Rr * Math.sin(a), 12, '255,190,90', 0.5 + 0.3 * Math.sin(performance.now() / 90)); }
      // collisions: flashes at the four points and a close-up in the middle of the ring
      if (phase === 'collide' && running) {
        for (const [k] of IPS) { const rate = (k === 1 || k === 5) ? 9 : 4; if (p.mode === 'head' ? Math.random() < rate * dtr : k === 1 && Math.random() < 6 * dtr) flashes.push({ k, age: 0, r: 7 + Math.random() * 7 }); }
        evt = evt || newEvent(); evt.age += dtr; if (evt.age > 0.95) evt = newEvent();
      }
      flashes = flashes.filter(f => (f.age += running ? dtr : 0) < 0.35);
      for (const f of flashes) { const a = ang(f.k); glow(c, cx + Rr * Math.cos(a), cy + Rr * Math.sin(a), f.r * (1 - f.age / 0.35) + 3, '255,245,200', 0.95 * (1 - f.age / 0.35)); }
      const ri = Rr * 0.6;
      if (phase === 'collide' || phase === 'done') {
        const ip = p.mode === 'head' ? 5 : 1, a = ang(ip);
        c.strokeStyle = 'rgba(214,224,218,0.3)'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(cx + (Rr - 9) * Math.cos(a), cy + (Rr - 9) * Math.sin(a)); c.lineTo(cx + ri * Math.cos(a), cy + ri * Math.sin(a)); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(3,6,8,0.92)'; c.beginPath(); c.arc(cx, cy, ri, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(214,224,218,0.4)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, ri, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cy, ri * 0.45, 0, TAU); c.strokeStyle = 'rgba(214,224,218,0.12)'; c.stroke();
        if (evt) drawEvent(c, cx, cy, ri, evt);
        if (phase === 'done') text(c, 'beams dumped', cx, cy, { size: 13, align: 'center', color: 'rgba(214,224,218,0.8)' });
        const cap = p.mode === 'head' ? (G.narrow ? 'inside CMS: r = p/(qB)' : 'inside CMS: tracks curve, r = p/(qB)') : (G.narrow ? 'fixed target' : 'fixed target: debris flies forwards');
        text(c, cap, cx, cy + ri + (Rr - ri) * 0.42, { size: G.narrow ? 10.5 : 11.5, align: 'center', color: 'rgba(214,224,218,0.78)' });
      } else {
        text(c, `${pl(b.frev, 6)}`, cx, cy - 10, { size: G.narrow ? 18 : 24, align: 'center', color: '#fff' });
        text(c, 'laps per second', cx, cy + 10, { size: G.narrow ? 10.5 : 12, align: 'center', color: 'rgba(214,224,218,0.75)' });
        text(c, `c − ${pl(b.slower, 3)} m/s`, cx, cy + (G.narrow ? 27 : 32), { size: G.narrow ? 12 : 14, align: 'center', color: '#9fd8ff' });
      }
      // scale bar and labels
      const kmPx = Rr / (circ() / TAU / 1000), sb = kmPx * 2;
      if (!G.narrow) {
        const sx = 16, sy = H - 16; c.fillStyle = 'rgba(214,224,218,0.7)'; c.fillRect(sx, sy, sb, 2); c.fillRect(sx, sy - 4, 1, 6); c.fillRect(sx + sb - 1, sy - 4, 1, 6);
        text(c, '2 km', sx + sb + 6, sy, { size: 11, color: 'rgba(214,224,218,0.75)' });
        text(c, 'The LHC from above', 16, 18, { size: 15 });
        text(c, 'beams drawn 100,000 × slower than real', 16, 36, { size: 11, color: 'rgba(214,224,218,0.65)' });
      }
      drawGauges(c, G, E, b);
    }
    // the gauges, or the collision counters
    function drawGauges(c, G, E, b) {
      const Emx = Math.max(7000, Etop);
      if (!G.narrow) {
        let y = G.gy;
        bar(c, G.gx, y, G.gw, 'Field in the dipole magnets', `${pl(b.B, 3)} T`, b.B / 9.5, [[0.535 / 9.5, 'injection', 'right'], [L.Bnom / 9.5, 'built for 8.33 T', 'left']], '255,176,32');
        y += 58;
        bar(c, G.gx, y, G.gw, 'Energy of each proton', gev(E), E / Emx, [[6800 / Emx, '6.8 TeV in 2022–26', 'left']], '120,200,255');
        y += 62;
        if (phase === 'collide' || phase === 'done') {
          if (p.mode === 'head') {
            text(c, 'Collisions in ATLAS and CMS', G.gx, y, { size: 12.5, color: 'rgba(214,224,218,0.82)' });
            text(c, pl(Math.floor(coll), 3), G.gx, y + 22, { size: 24, color: '#fff' });
            text(c, higgsOK() ? `Higgs bosons made: about ${pl(coll * L.higgs, 2)}` : 'Higgs: the 1-in-a-billion figure is for 13.6 TeV', G.gx, y + 46, { size: 12.5, color: '#9df5b8' });
          } else text(c, `Collision energy only ${gev(beamAt(Etop).fixed)}: no Higgs (125 GeV)`, G.gx, y, { size: 13, color: '#ffd590' });
        } else {
          text(c, 'r = p/(qB), so to keep r fixed:', G.gx, y, { size: 12.5, color: 'rgba(214,224,218,0.75)' });
          text(c, `B = p/(qρ) = ${pl(b.p, 4)} GeV/c ÷ (e × ${pl(rho(), 4)} m) = ${pl(b.B, 3)} T`, G.gx, y + 20, { size: 14, color: '#ffd590' });
          if (phase === 'ramp') text(c, `+${kev(gainLap())} per lap from the RF cavities; the magnets ramp at ${pl(BDOT * 1000, 3)} mT a second`, G.gx, y + 42, { size: 12, color: 'rgba(214,224,218,0.75)' });
        }
      } else {
        const y = G.gy, half = (G.gw - 14) / 2;
        if (phase === 'collide' || phase === 'done') {
          if (p.mode === 'head') {
            text(c, `${pl(Math.floor(coll), 3)} collisions`, G.gx, y + 4, { size: 17, color: '#fff' });
            text(c, 'in ATLAS and CMS', G.gx, y + 24, { size: 11, color: 'rgba(214,224,218,0.75)' });
            text(c, higgsOK() ? `Higgs bosons: about ${pl(coll * L.higgs, 2)}` : 'Higgs: needs 13.6 TeV', G.gx, y + 46, { size: 12, color: '#9df5b8' });
          } else text(c, `only ${gev(beamAt(Etop).fixed)}: no Higgs`, G.gx, y + 10, { size: 13, color: '#ffd590' });
        } else {
          bar(c, G.gx, y, half, 'Field B', `${pl(b.B, 3)} T`, b.B / 9.5, [[L.Bnom / 9.5, '', '']], '255,176,32');
          bar(c, G.gx + half + 14, y, half, 'Energy', gev(E), E / Emx, [], '120,200,255');
          text(c, 'beams drawn 100,000 × slower', G.gx, y + 50, { size: 10.5, color: 'rgba(214,224,218,0.6)' });
        }
      }
    }
    /* ---- 3D: the land at night with the ring under it, seen as if the ground were glass. One unit = 1 km.
       The map is laid out like the flat view: Point 1 (ATLAS) to the south, the Jura beyond Point 5 to the north,
       Geneva and its lake to the south-east. The ring is about 100 m down; it is drawn 5× deeper so the shafts show. */
    const R1 = L.circ / TAU / 1000, DEEP = 0.5;
    const ptA = k => -ang(k);                                            // the flat view's angle, turned into north-up
    let land = null, v3l = null;
    function makeLand() {
      const lights = [], add = (x0, y0, n, spread, warm, seed) => { for (let i = 0; i < n; i++) { const a = hash(i * 3 + seed) * TAU, r = Math.pow(hash(i * 7 + seed + 1), 0.7) * spread, bb = hash(i + seed + 2); lights.push([x0 + Math.cos(a) * r, y0 + Math.sin(a) * r * 0.8, bb, warm]); } };
      add(1.30 * R1, -1.45 * R1, 520, 0.6 * R1, true, 11);                         // Geneva
      add(0.12 * R1, -1.12 * R1, 120, 0.22 * R1, true, 23);                        // Meyrin, by CERN
      for (let v = 0; v < 22; v++) { const x = (hash(v + 70) * 2 - 1) * 3.2 * R1, y = (hash(v + 80) * 2 - 1) * 2.6 * R1; if (y > 1.35 * R1) continue; add(x, y, 26, 0.09 * R1, hash(v + 90) > 0.3, 100 + v * 31); }
      const lake = [], c0 = [2.63 * R1, -0.98 * R1], ca = Math.cos(0.42), sa = Math.sin(0.42);
      for (let i = 0; i < 56; i++) { const a = TAU * i / 56, u = 1.55 * R1 * Math.cos(a) * (1 + 0.06 * Math.sin(3 * a)), w = 0.32 * R1 * Math.sin(a) * (1 + 0.15 * Math.cos(2 * a)); lake.push([c0[0] + u * ca - w * sa, c0[1] + u * sa + w * ca, 0.004]); }
      const inLake = (x, y) => { const dx = x - c0[0], dy = y - c0[1], u = dx * ca + dy * sa, w = -dx * sa + dy * ca; return (u / (1.55 * R1)) ** 2 + (w / (0.32 * R1)) ** 2 < 1.05; };
      const patches = []; for (let i = 0; i < 90; i++) { const x = (hash(i + 300) * 2 - 1) * 4 * R1, y = (hash(i + 310) * 2 - 1) * 3 * R1, w = (0.08 + 0.25 * hash(i + 320)) * R1, h = (0.06 + 0.18 * hash(i + 330)) * R1, t = hash(i + 340) * 3; if (inLake(x, y)) continue; const ct = Math.cos(t), st = Math.sin(t); patches.push({ pts: [[-w, -h], [w, -h], [w, h], [-w, h]].map(([u, v]) => [x + u * ct - v * st, y + u * st + v * ct, 0.002]), dark: hash(i + 350) > 0.45 }); }
      // the Jura: a ridge running east–west beyond Point 5, about 1.2 km above the plain
      const ridge = [], rc = Math.cos(0.12), rs = Math.sin(0.12), Rt = (u, v, z) => [u * rc - v * rs, 1.75 * R1 + u * rs + v * rc, z];
      const n = 40, us = i => (-4.5 + 9 * i / n) * R1, hgt = i => (0.75 + 0.5 * hash(i + 500)) * (1 - Math.pow(Math.abs(us(i)) / (4.6 * R1), 6));
      for (let i = 0; i < n; i++) { const u0 = us(i), u1 = us(i + 1), h0 = hgt(i), h1 = hgt(i + 1), w = 0.55 * R1; ridge.push([Rt(u0, -w, 0), Rt(u1, -w, 0), Rt(u1, 0, h1), Rt(u0, 0, h0)], [Rt(u0, 0, h0), Rt(u1, 0, h1), Rt(u1, w * 1.4, 0), Rt(u0, w * 1.4, 0)]); }
      const towns = [[1.3 * R1, -1.45 * R1], [0.12 * R1, -1.12 * R1]];
      for (let v = 0; v < 22; v++) { const x = (hash(v + 70) * 2 - 1) * 3.2 * R1, y = (hash(v + 80) * 2 - 1) * 2.6 * R1; if (y <= 1.35 * R1) towns.push([x, y]); }
      const roads = [];
      for (let i = 2; i < towns.length; i++) { let best = 0, bd = 1e9; for (let j = 0; j < i; j++) { const d = Math.hypot(towns[i][0] - towns[j][0], towns[i][1] - towns[j][1]); if (d < bd) { bd = d; best = j; } } const a = towns[i], b2 = towns[best], mx = (a[0] + b2[0]) / 2 + (hash(i + 600) - 0.5) * bd * 0.3, my = (a[1] + b2[1]) / 2 + (hash(i + 610) - 0.5) * bd * 0.3; roads.push([[a[0], a[1], 0.003], [mx, my, 0.003], [b2[0], b2[1], 0.003]]); }
      const river = [[1.22 * R1, -1.5 * R1, 0.003]]; for (let i = 1; i <= 24; i++) { const q = river[i - 1]; river.push([q[0] - 0.22 * R1, q[1] - 0.1 * R1 + Math.sin(i * 1.3) * 0.08 * R1, 0.003]); }
      return { lights: lights.filter(q => !inLake(q[0], q[1])), lake, patches, ridge, roads, river };
    }
    const ringPts = (r, z, n = 160, a0 = 0, a1 = TAU) => { const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([r * Math.cos(a), r * Math.sin(a), z]); } return pts; };
    function band(sc, r, w, z, a0, a1, n, st) { for (let i = 0; i < n; i++) { const b0 = a0 + (a1 - a0) * i / n, b1 = a0 + (a1 - a0) * (i + 1) / n, c0 = Math.cos(b0), s0 = Math.sin(b0), c1 = Math.cos(b1), s1 = Math.sin(b1); sc.poly([[(r - w) * c0, (r - w) * s0, z], [(r + w) * c0, (r + w) * s0, z], [(r + w) * c1, (r + w) * s1, z], [(r - w) * c1, (r - w) * s1, z]], st); } }
    function drawLHC3d(sc, c, W, H, dtr, running) {
      const G = layout(W, H), E = Enow(), b = beamAt(E), Bf = clamp(b.B / L.Bnom, 0, 1.2), tt = performance.now() / 1000;
      const live = phase !== 'done', moving = running || phase === 'ready';
      if (moving && live) rot += dtr * TAU * 0.112455;                       // drawn 100,000 times slower than real
      if (!land) land = makeLand();
      const Rk = circ() / TAU / 1000, Rv = Math.max(Rk, R1 * 0.8), fov = 46, f = 0.5 * Math.min(W * 0.85, H * 1.05) / Math.tan(fov * Math.PI / 360);
      // wide: the ring left of centre, the gauges in a panel top right; narrow: as the flat view, ring on top, gauges below
      const gw = Math.min(400, W * 0.38), G3 = G.narrow ? G : { narrow: false, gx: W - 60 - gw, gy: 70, gw };
      const R0 = G.narrow ? Math.min(W * 0.36, (H - 170) * 0.8) : Math.min(W * 0.3, H * 0.42), want = f * Rv / R0 * 1.3;
      v3l = v3l ? v3l + (want - v3l) * clamp(dtr * 4, 0, 1) : want;
      const shift = G.narrow ? -0.05 : -0.14, lift = G.narrow ? (G.cy - 22 - H / 2) / H : 0.1;
      sc.begin(c, W, H, { dist: v3l, target: [0, 0.1 * R1, 0], shift, lift, fov, bg: [18, 24, 34], fogNear: 1.2, fogFar: 4.5, fogMax: 0.85, backdrop: (g, W2, H2, hy) => {
        const sg = g.createLinearGradient(0, Math.min(0, hy - H2 * 0.6), 0, hy); sg.addColorStop(0, '#03050c'); sg.addColorStop(0.6, '#0c1528'); sg.addColorStop(1, '#46404e');
        g.fillStyle = sg; g.fillRect(0, 0, W2, H2);
        drawSky3d(g, W2, H2, sc, tt, { up: true, horizon: hy, dim: 0.9 });
        if (hy < H2) { g.fillStyle = '#121a1e'; g.fillRect(0, Math.max(0, hy), W2, H2); }
      } });
      // the land: plain, fields and woods, the lake, then the lights of Geneva, Meyrin and the villages
      const BK = { layer: 'back' };
      sc.poly([[-14 * R1, -14 * R1, 0], [14 * R1, -14 * R1, 0], [14 * R1, 14 * R1, 0], [-14 * R1, 14 * R1, 0]], { rgb: [16, 24, 22], shade: false, layer: 'back' });
      for (const q of land.patches) sc.poly(q.pts, { rgb: q.dark ? [9, 15, 13] : [26, 38, 30], a: 0.55, shade: false, layer: 'back' });
      for (const r of land.roads) sc.path(r, 'rgba(255,190,120,0.13)', 1, Object.assign({ chunk: 2 }, BK));
      sc.path(land.river, 'rgba(60,100,150,0.55)', 2, Object.assign({ chunk: 4 }, BK));
      sc.poly(land.lake, { rgb: [10, 21, 34], shade: false, layer: 'back' });
      sc.path(land.lake.concat([land.lake[0]]), 'rgba(150,190,230,0.3)', 1, Object.assign({ chunk: 8 }, BK));
      sc.custom([0, 0, 0], g => {
        for (const q of land.lights) {
          const cq = sc.cam([q[0], q[1], 0.003]); if (cq[2] <= sc.near) continue;
          const sp = sc.scr(cq), fa = 1 - sc.fogK(cq[2]) * 0.7, bb = q[2], sz = (bb > 0.85 ? 1.9 : 1.2) * clamp(1.6 * sc.f / cq[2] / 60, 0.7, 1.6);
          g.fillStyle = q[3] ? `rgba(255,${190 + 40 * bb | 0},${110 + 60 * bb | 0},${(0.35 + 0.55 * bb) * fa})` : `rgba(210,225,255,${(0.25 + 0.45 * bb) * fa})`;
          g.fillRect(sp[0] - sz / 2, sp[1] - sz / 2, sz, sz);
        }
        const gq = sc.project([1.3 * R1, -1.45 * R1, 0]); if (gq) glow(g, gq.x, gq.y, gq.k * 0.8 * R1, '255,170,90', 0.13);
      }, BK);
      for (const f of land.ridge) sc.poly(f, { rgb: [16, 20, 25], amb: 0.7, spec: 0, noFog: true });
      // the ring underground: the tunnel, the eight arcs of dipoles glowing with their field, the two beam pipes
      const z = -DEEP, hot = [255, Math.round(150 + 80 * Math.min(1, Bf)), Math.round(60 + 110 * Math.min(1, Bf))];
      if (Math.abs(p.k - 1) > 1e-9) sc.path(ringPts(R1, z, 160), 'rgba(120,200,255,0.4)', 1.2, { dash: [5, 6] });
      band(sc, Rk, 0.07 * Math.max(1, Rk / R1), z - 0.002, 0, TAU, 96, { rgb: [24, 32, 38], shade: false, a: 0.9 });
      for (let k = 1; k <= 8; k++) {
        const a0 = ptA(k) - 0.1, a1 = ptA(k) - Math.PI / 4 + 0.1;
        band(sc, Rk, 0.035, z, a1, a0, 10, { rgb: hot, shade: false, a: 0.3 + 0.65 * Math.min(1, Bf) });
        sc.path(ringPts(Rk, z + 0.003, 14, a1, a0), `rgba(${hot},${0.35 + 0.6 * Math.min(1, Bf)})`, 2.2, { chunk: 3, glow: `rgba(255,170,60,${0.3 + 0.6 * Math.min(1, Bf)})` });
        for (let i = 0; i < 4; i++) { const a = a1 + (a0 - a1) * (i + 0.5) / 4; sc.glow([Rk * Math.cos(a), Rk * Math.sin(a), z], 0.42 * Math.max(0.6, Rk / R1), hot, 0.07 + 0.2 * Math.min(1, Bf)); }
      }
      for (const dr of [0.018, -0.018]) sc.path(ringPts(Rk + dr, z + 0.004, 160), 'rgba(170,200,220,0.35)', 1, { chunk: 4 });
      // bunches: beam 1 clockwise seen from above (blue), beam 2 anticlockwise (red); 100,000 times slower than real
      if (live) {
        const n = 64, fill = 54;
        for (const [dr, dir, rgb, show] of [[0.018, 1, [120, 200, 255], true], [-0.018, -1, [255, 128, 110], p.mode === 'head']]) {
          if (!show) continue;
          for (let i = 0; i < fill; i++) { const a = -(dir * rot + i * TAU / n + (dir < 0 ? 0.37 : 0)); sc.glow([(Rk + dr) * Math.cos(a), (Rk + dr) * Math.sin(a), z + 0.006], 3.4, rgb, 0.85, { px: true }); }
        }
      }
      // the eight points: shafts up to the buildings on the surface; caverns for the four experiments; the RF at Point 4
      for (let k = 1; k <= 8; k++) {
        const a = ptA(k), x = Rk * Math.cos(a), y = Rk * Math.sin(a), ip = IPS.find(q => q[0] === k);
        sc.line([x, y, z], [x, y, 0], 'rgba(214,224,218,0.45)', 1);
        sc.box([x, y, 0.035], [0.09, 0.06, 0.035], { rgb: [120, 130, 138], amb: 0.6 }, [[-Math.sin(a), Math.cos(a), 0], [Math.cos(a), Math.sin(a), 0], [0, 0, 1]]);
        sc.glow([x, y, 0.075], 3, [255, 220, 150], 0.55, { px: true });
        if (ip) {
          sc.box([x, y, z], [0.2, 0.12, 0.1], { rgb: [70, 90, 104], amb: 0.65, spec: 0.2 }, [[-Math.sin(a), Math.cos(a), 0], [Math.cos(a), Math.sin(a), 0], [0, 0, 1]]);
          sc.label([x, y, 0.32], ip[1], { color: '#eef2ec' });
        }
      }
      { const a = ptA(4); sc.label([Rk * Math.cos(a), Rk * Math.sin(a), 0.3], G.narrow ? 'RF' : 'RF cavities', { color: 'rgba(255,214,140,0.9)' }); if (phase === 'ramp' && running) sc.glow([Rk * Math.cos(a), Rk * Math.sin(a), z], 0.5, [255, 190, 90], 0.5 + 0.3 * Math.sin(performance.now() / 90)); }
      if (G.narrow) { const a = ptA(1); sc.label([Rk * Math.cos(a), Rk * Math.sin(a), z], '100 m down (drawn 5× deeper)', { dy: 14, color: 'rgba(214,224,218,0.7)', font: '600 10.5px "Barlow Condensed", "Arial Narrow", sans-serif' }); }
      else { const a = ptA(3); sc.label([Rk * Math.cos(a), Rk * Math.sin(a), z * 0.5], 'about 100 m down (drawn 5× deeper)', { dx: -10, align: 'right', color: 'rgba(214,224,218,0.7)', font: '600 11.5px "Barlow Condensed", "Arial Narrow", sans-serif' }); }
      if (!G.narrow) { sc.label([1.3 * R1, -1.2 * R1, 0.2], 'Geneva', { color: 'rgba(255,214,140,0.8)' }); sc.label([0, 1.75 * R1, 1.6], 'Jura mountains', { color: 'rgba(190,200,210,0.7)' }); }
      // collisions: flashes at the points where the beams cross
      if (phase === 'collide' && running) {
        for (const [k] of IPS) { const rate = (k === 1 || k === 5) ? 9 : 4; if (p.mode === 'head' ? Math.random() < rate * dtr : k === 1 && Math.random() < 6 * dtr) flashes.push({ k, age: 0, r: 7 + Math.random() * 7 }); }
        evt = evt || newEvent(); evt.age += dtr; if (evt.age > 0.95) evt = newEvent();
      }
      flashes = flashes.filter(f => (f.age += running ? dtr : 0) < 0.35);
      for (const f of flashes) { const a = ptA(f.k); sc.glow([Rk * Math.cos(a), Rk * Math.sin(a), z + 0.01], (f.r * (1 - f.age / 0.35) + 3) * 1.6, [255, 245, 200], 0.95 * (1 - f.age / 0.35), { px: true }); }
      sc.end();
      // what the flat view writes in the middle of the ring, here over the ring's centre; the close-up of a collision
      const mid = sc.project([0, 0, z]);
      const ri = G.narrow ? Math.min(W * 0.17, 64) : Math.min(H * 0.2, 96), ix = 14 + ri, iy = G.narrow ? 54 + ri : 58 + ri;
      if (phase === 'collide' || phase === 'done') {
        const ipk = p.mode === 'head' ? 5 : 1, a = ptA(ipk), q = sc.project([Rk * Math.cos(a), Rk * Math.sin(a), z]);
        if (q) { c.strokeStyle = 'rgba(214,224,218,0.35)'; c.setLineDash([3, 4]); c.lineWidth = 1; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(ix + (q.x - ix) * ri / Math.max(ri, Math.hypot(q.x - ix, q.y - iy)), iy + (q.y - iy) * ri / Math.max(ri, Math.hypot(q.x - ix, q.y - iy))); c.stroke(); c.setLineDash([]); }
        c.fillStyle = 'rgba(3,6,8,0.92)'; c.beginPath(); c.arc(ix, iy, ri, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(214,224,218,0.4)'; c.lineWidth = 1; c.beginPath(); c.arc(ix, iy, ri, 0, TAU); c.stroke(); c.beginPath(); c.arc(ix, iy, ri * 0.45, 0, TAU); c.strokeStyle = 'rgba(214,224,218,0.12)'; c.stroke();
        if (evt) drawEvent(c, ix, iy, ri, evt);
        if (phase === 'done') text(c, 'beams dumped', ix, iy, { size: 13, align: 'center', color: 'rgba(214,224,218,0.8)' });
        text(c, p.mode === 'head' ? 'inside CMS: tracks curve, r = p/(qB)' : 'fixed target: debris flies forwards', ix, iy + ri + 12, { size: 11.5, align: 'center', color: 'rgba(214,224,218,0.78)' });
      } else if (G.narrow) {
        const near = sc.project([0, -Rk, z]), y = Math.min(G.gy - 44, near ? near.y + 46 : G.gy - 44), x = W / 2 - 0.05 * W;
        text(c, `${pl(b.frev, 6)} laps per second`, x, y, { size: 15, align: 'center', color: '#fff' });
        text(c, `c − ${pl(b.slower, 3)} m/s`, x, y + 18, { size: 12, align: 'center', color: '#9fd8ff' });
      } else if (mid) {
        text(c, `${pl(b.frev, 6)}`, mid.x, mid.y - 10, { size: 24, align: 'center', color: '#fff' });
        text(c, 'laps per second', mid.x, mid.y + 10, { size: 12, align: 'center', color: 'rgba(214,224,218,0.75)' });
        text(c, `c − ${pl(b.slower, 3)} m/s`, mid.x, mid.y + 32, { size: 14, align: 'center', color: '#9fd8ff' });
      }
      if (!G.narrow) {
        if (phase !== 'collide' && phase !== 'done') { text(c, 'The LHC at night, the ground drawn see-through', 16, 18, { size: 15 }); text(c, `${pl(circ() / 1000, 3)} km round · beams drawn 100,000 × slower than real`, 16, 36, { size: 11, color: 'rgba(214,224,218,0.65)' }); }
        c.fillStyle = 'rgba(3,6,10,0.66)'; rrect(c, G3.gx - 16, G3.gy - 20, G3.gw + 32, 196, 10); c.fill();
      }
      drawGauges(c, G3, E, b);
    }
    return sim;
  }

  /* =====================================================================
     Aurora, version 2: from the Sun. Many solar-wind particles meet Earth's magnetic field. Most are turned aside
     and flow around it; where the Sun's field links with Earth's some get in, are carried into the tail and slide down
     field lines into a ring round each magnetic pole: the auroral ovals. Distances in Earth radii (R_E).
     Scene axes as in version 1: the Sun far off along −x, midnight +x, dawn +y, north +z.
     ===================================================================== */
  function makeSolarWind() {
    const SCEN = {
      quiet: { t: 'Quiet Sun', v: 350, n: 5, bz: 3, note: 'A slow wind whose magnetic field points north, the same way as Earth’s field at the nose: the two hardly join, so little gets in and the oval stays far north and faint.' },
      south: { t: 'Field turns south', v: 400, n: 5, bz: -5, note: 'The usual wind speed near Earth (about 400 km/s, NOAA), with the Sun’s field pointing south, against Earth’s field at the nose: the fields join, the door opens and the oval grows.' },
      fast: { t: 'Fast wind', v: 650, n: 4, bz: -8, note: 'A high-speed stream from a coronal hole (500–800 km/s, NOAA): a harder push and faster linking.' },
      storm: { t: 'Big storm (May 2024)', v: 750, n: 20, bz: -45, note: 'Like 10–11 May 2024: about 750 km/s with Bz near −45 nT gave Kp 9, and aurora was seen far from the poles. (The density here is an assumed value.)' },
    };
    const p = { scen: 'south', v: 400, n: 5, bz: -5, nofield: false };
    const ctls = {};
    let w = R.solarWind(p), wn = R.noField(w), fm = R.fieldModel(w), geo = null, geoKey = '', parts = [], hits = [], t = 0, nAur = 0, nCusp = 0, last = null;
    let ions = [], nIon = 0;                               // without a field: ions from the top of the air, carried off by the wind
    const G = () => (p.nofield ? wn : w);                 // the shape the wind meets: Earth's magnetosphere, or the bare atmosphere
    const BOX = () => (p.nofield ? { x0: -16, x1: 20, r: 7 } : { x0: -56, x1: 60, r: 31 });
    const glowB = new Float32Array(96);                  // brightness of the oval in 48 magnetic-local-time bins, north then south
    let v3s = null, scG = null, gYaw = 0, imfOff = 0, hist = [];
    const RKM = RE / 1e3, SUN = [-1, 0, 0];
    const vRE = () => p.v / RKM;                        // the wind's speed in Earth radii per second
    const VLINE = 24;                                    // Earth radii per second of screen time while sliding down a field line (drawn far slower than real)
    const ovalLat = h => w.latEq + 8 * (1 - Math.cos(h / 24 * TAU)) / 2;    // degrees: the NOAA edge at midnight, about 8° higher at noon
    const ovalWid = () => 4 + 0.5 * w.kp;
    const gNorm = () => Math.min(2, w.dphi / 25000);
    const NP = () => ((window.innerWidth || 1000) < 600 ? 260 : 460);
    const fmtDays = s => s >= 86400 ? `${pl(s / 86400, 2)} days` : `${pl(s / 3600, 2)} hours`;
    const fmtPow = P => P >= 1e12 ? `${pl(P / 1e12, 3)} TW` : P >= 1e9 ? `${pl(P / 1e9, 3)} GW` : P >= 1e6 ? `${pl(P / 1e6, 3)} MW` : P > 0 ? `${pl(P, 3)} W` : '0 W';
    const reKm = r => `${pl(r * RKM, 3)} km`;

    /* ---- the shapes: field lines to draw, lines the particles slide down, the cusps ---- */
    const farthest = pts => { let ia = 0, rm = 0; pts.forEach((q, i) => { const r = Math.hypot(q[0], q[1], q[2]); if (r > rm) { rm = r; ia = i; } }); return ia; };
    function dipLine(lat, h) { const L = 1 / Math.cos(lat) ** 2, pts = []; for (let i = 0; i <= 60; i++) { const la = lat - 2 * lat * i / 60; pts.push(R.footAt(la, h, L * Math.cos(la) ** 2)); } return pts; }
    function build() {
      w = R.solarWind(p); wn = R.noField(w); fm = R.fieldModel(w);
      const key = [p.v, p.n, p.bz].join();
      if (geo && key === geoKey) return;
      geoKey = key;
      const lines = [], add = (lat, h) => { const a = R.traceLine(w, fm, R.footAt(lat * DEG, h), -1); a.h = h; lines.push(a); if (a.end !== 'earth') { const b = R.traceLine(w, fm, R.footAt(-lat * DEG, h), 1); b.h = h; lines.push(b); } };
      for (const h of [0, 12]) for (const lat of [58, 63, 67, 70, 72, 74, 76, 78, 81, 85]) add(lat, h);
      for (const h of [6, 18]) for (const lat of [62, 67, 71, 75]) add(lat, h);
      const pre = [];
      for (let k = -6; k <= 6; k++) for (const fr of [0.2, 0.55, 0.9]) {
        const h = (k * 1.5 + 24) % 24, lat = (ovalLat(h) + fr * ovalWid()) * DEG;
        const a = R.traceLine(w, fm, R.footAt(lat, h), -1), pts = a.end === 'earth' ? a.pts : dipLine(lat, h);
        pre.push({ h, k, lat, pts, ia: farthest(pts) });
      }
      const cus = [];
      for (const h of [11, 12, 13]) for (const sg of [1, -1]) {
        const a = R.traceLine(w, fm, R.footAt(sg * w.latCusp * DEG, h), -sg);
        const pts = a.end === 'earth' ? a.pts.slice(0, farthest(a.pts) + 1) : a.pts;
        cus.push({ sg, h, pts: pts.slice().reverse() });          // from out in space down to the foot
      }
      geo = { lines, pre, cus };
    }

    /* ---- the particles ---- */
    function spawn(P, anywhere) {
      const B = BOX(), rr = B.r * Math.sqrt(Math.random()), a = Math.random() * TAU;
      P.x = anywhere ? B.x0 + Math.random() * (B.x1 - B.x0) : B.x0 - Math.random() * (p.nofield ? 2 : 6); P.y = rr * Math.cos(a); P.z = rr * Math.sin(a);
      P.st = 0; P.vx = 1; P.vy = 0; P.vz = 0; P.path = null; P.tried = 0; P.kind = '';
      if (anywhere) {
        const g = G(), r = Math.hypot(P.x, P.y, P.z), th = R.thetaOf(P.x, P.y, P.z);
        if (r < R.mpR(g, th) + 0.4) spawn(P, false);
        else if (r < R.bsR(g, th)) P.st = 1;
      }
    }
    function startPath(P, path, ls, kind) { P.st = 2; P.path = path; P.ls = ls; P.k = 0; P.f = 0; P.kind = kind; }
    function tryEnter(P, th, rm, rn) {
      if (P.tried || rn - rm > 2.4) return;
      const g = gNorm();
      if (P.x < 3 && th > 0.45 && th < 1.4 && Math.abs(P.z) > 0.42 * rn) {            // high-latitude day side: the cusps
        P.tried = 1;
        if (Math.random() < 0.03 + 0.2 * g) {
          const cs = geo.cus.filter(c => c.sg === (P.z > 0 ? 1 : -1)), c = cs[Math.floor(Math.random() * cs.length)];
          startPath(P, [[P.x, P.y, P.z]].concat(c.pts), 1, 'cusp');
        }
      } else if (P.x > 14) {                                                         // the tail: in through the lobes, into the plasma sheet
        P.tried = 1;
        if (Math.random() < 0.05 + 0.32 * g) enterTail(P);
      }
    }
    function enterTail(P) {
      const side = P.y >= 0 ? 1 : -1;
      const cand = geo.pre.filter(q => q.k === 0 || Math.sign(q.k) === side), wt = cand.map(q => Math.exp(-((q.k * 1.5) ** 2) / 18)), tot = wt.reduce((a, b) => a + b, 0);
      let u = Math.random() * tot, q = cand[0];
      for (let i = 0; i < cand.length; i++) { u -= wt[i]; if (u <= 0) { q = cand[i]; break; } }
      // drift into the tail to the plasma sheet (where the field lines join again), then shoot back towards Earth along it
      const A = q.pts[q.ia], S = [clamp(P.x + 10, 20, 34), A[1] * 1.2 + (Math.random() - 0.5) * 4, 0], I = [Math.max(A[0] + 2.5, 5), A[1], 0];
      const line = Math.random() < 0.5 ? q.pts.slice(0, q.ia + 1).reverse() : q.pts.slice(q.ia);
      const path = [[P.x, P.y, P.z], [(P.x + S[0]) / 2 + 3, P.y * 0.55, P.z * 0.35], S, I].concat(line);
      startPath(P, path, 4, 'oval');
    }
    function followPath(P, dts, dtr) {
      let rem = P.k < P.ls ? vRE() * dts * 0.6 : VLINE * dtr;
      while (rem > 0 && P.k < P.path.length - 1) {
        const a = P.path[P.k], b = P.path[P.k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1e-9, left = L * (1 - P.f);
        if (rem < left) { P.f += rem / L; rem = 0; }
        else { rem -= left; P.k++; P.f = 0; if (P.k === P.ls) rem = Math.min(rem, VLINE * dtr); }
      }
      const a = P.path[P.k], b = P.path[Math.min(P.k + 1, P.path.length - 1)];
      const nx = a[0] + (b[0] - a[0]) * P.f, ny = a[1] + (b[1] - a[1]) * P.f, nz = a[2] + (b[2] - a[2]) * P.f;
      const d = Math.hypot(nx - P.x, ny - P.y, nz - P.z) || 1;
      P.vx = (nx - P.x) / d; P.vy = (ny - P.y) / d; P.vz = (nz - P.z) / d; P.x = nx; P.y = ny; P.z = nz;
      if (P.k >= P.path.length - 1) land(P);
    }
    function land(P) {
      const r = Math.hypot(P.x, P.y, P.z), lat = Math.asin(clamp(P.z / r, -1, 1)), h = ((Math.atan2(P.y, P.x) / TAU * 24) + 24) % 24;
      const cusp = P.kind === 'cusp', alt = cusp ? 250e3 + Math.random() * 70e3 : Math.random() < 0.85 ? 100e3 + Math.random() * 45e3 : 190e3 + Math.random() * 60e3;
      hits.push({ lat, h, alt, age: 0, cusp });
      if (hits.length > 500) hits.splice(0, hits.length - 500);
      glowB[(lat > 0 ? 0 : 48) + Math.floor(h / 0.5) % 48] += cusp ? 0.6 : 1;
      if (cusp) nCusp++; else nAur++;
      spawn(P, false);
    }
    function stepParts(dts, dtr) {
      const V = vRE() * dts, g = G(), B = BOX();
      for (const P of parts) {
        if (P.st === 0) {
          P.x += V;
          if (Math.hypot(P.x, P.y, P.z) < R.bsR(g, R.thetaOf(P.x, P.y, P.z))) P.st = 1;
        } else if (P.st === 1) {
          // past the bow shock: flow round a blunt body (a uniform flow plus a source at the Earth), slower and hotter
          const r2 = P.x * P.x + P.y * P.y + P.z * P.z, r = Math.sqrt(r2), b2 = g.r0 * g.r0 / r2, j = p.nofield ? 0.12 : 0.24;
          const ux = 1 + b2 * P.x / r + (Math.random() - 0.5) * j, uy = b2 * P.y / r + (Math.random() - 0.5) * j, uz = b2 * P.z / r + (Math.random() - 0.5) * j;
          P.x += ux * V * 0.8; P.y += uy * V * 0.8; P.z += uz * V * 0.8;
          const m = Math.hypot(ux, uy, uz) || 1; P.vx = ux / m; P.vy = uy / m; P.vz = uz / m;
          const th = R.thetaOf(P.x, P.y, P.z), rm = R.mpR(g, th) + (p.nofield ? 0.04 : 0.3), rn = Math.hypot(P.x, P.y, P.z);
          if (th < 2.7 && rn < rm) { const k = rm / rn; P.x *= k; P.y *= k; P.z *= k; }
          if (!p.nofield) tryEnter(P, th, rm, Math.hypot(P.x, P.y, P.z));
        } else followPath(P, dts, dtr);
        if (P.st < 2 && (P.x > B.x1 + 4 || Math.abs(P.y) > B.r + 19 || Math.abs(P.z) > B.r + 19)) spawn(P, false);
      }
      if (p.nofield) stepIons(dts);
    }
    // Without a field the wind brushes the top of the atmosphere itself. Its electric field, E = −v × B, picks up ions
    // there and sweeps them away: most down the tail, some in a plume to one side (MAVEN saw this at Mars, about 75 % and 25 %).
    function stepIons(dts) {
      const T = 6 / vRE();                                    // seconds for the wind to cross 6 Earth radii
      let k = 34 * dts / T; while (k > 0) { if (Math.random() < k) newIon(); k -= 1; }
      for (const q of ions) {
        q.age += dts; const u = q.age / T;
        q.px = q.x; q.py = q.y; q.pz = q.z;
        q.x = q.x0 + 6 * u * u; q.y = q.y0 + q.side * 2.6 * u * u + q.y0 * 0.08 * u; q.z = q.z0 + q.z0 * 0.08 * u;
      }
      ions = ions.filter(q => q.age < 2.4 * T && q.x < 24);
    }
    function newIon() {
      const plume = Math.random() < 0.25, side = (p.bz < 0 ? -1 : 1) * (plume ? 1 : 0);
      const th = (plume ? 55 : 72 + Math.random() * 28) * DEG, ph = plume ? (side < 0 ? -Math.PI / 2 : Math.PI / 2) + (Math.random() - 0.5) * 0.8 : Math.random() * TAU, r = 1.05 + Math.random() * 0.08;
      const x0 = -r * Math.cos(th), y0 = r * Math.sin(th) * Math.cos(ph), z0 = r * Math.sin(th) * Math.sin(ph);
      ions.push({ x0, y0, z0, x: x0, y: y0, z: z0, px: x0, py: y0, pz: z0, age: 0, side });
      nIon++;
    }
    function reset() {
      build();
      t = 0; nAur = nCusp = 0; hits = []; glowB.fill(0); hist = [];
      parts = []; for (let i = 0, n = NP(); i < n; i++) { const P = {}; spawn(P, true); parts.push(P); }
      ions = []; nIon = 0;
      // some plasma is already on its way in through the tail, so the ovals light up soon after Start
      const m = p.nofield ? 0 : Math.round(parts.length * (0.03 + 0.1 * Math.min(1, gNorm())));
      for (let i = 0; i < m; i++) {
        const P = parts[i], th = 1.9 + Math.random() * 0.5, ph = Math.random() * TAU, r = R.mpR(w, th) + 0.6;
        P.x = -r * Math.cos(th); P.y = r * Math.sin(th) * Math.cos(ph); P.z = r * Math.sin(th) * Math.sin(ph); P.st = 1; P.tried = 1;
        enterTail(P); P.k = Math.floor(Math.random() * P.ls); P.f = Math.random();
        const A = P.path[P.k], B = P.path[P.k + 1]; P.x = A[0] + (B[0] - A[0]) * P.f; P.y = A[1] + (B[1] - A[1]) * P.f; P.z = A[2] + (B[2] - A[2]) * P.f;
        const d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) || 1; P.vx = (B[0] - A[0]) / d; P.vy = (B[1] - A[1]) / d; P.vz = (B[2] - A[2]) / d;
      }
    }
    function step(dts, dtr) {
      t += dts; imfOff += vRE() * dts;
      stepParts(dts, dtr);
      if (!hist.length || t - hist[hist.length - 1][0] > 20) hist.push([t, nAur, nCusp]);
      return false;
    }
    function age(dtr) {
      const k = Math.exp(-dtr / 3.5);
      for (let i = 0; i < 96; i++) glowB[i] *= k;
      for (const q of hits) q.age += dtr;
      hits = hits.filter(q => q.age < 6);
    }

    /* ---- drawing, shared parts ---- */
    const actA = () => clamp(0.07 + 0.3 * Math.sqrt(Math.min(1, w.eps / 1.5e12)), 0.07, 0.4);       // how bright the expected oval is drawn
    const colOf = alt => alt >= 200e3 ? '255,90,80' : alt >= 150e3 ? '220,200,110' : '90,255,140';
    function ovalOn(sc, r = 1.02) {
      for (const sg of [1, -1]) {
        for (const fr of [0, 1]) {
          const pts = []; for (let i = 0; i <= 72; i++) { const h = 24 * i / 72, la = (ovalLat(h) + fr * ovalWid()) * DEG; pts.push(R.footAt(sg * la, h, r)); }
          sc.path(pts, `rgba(90,255,140,${actA() * (fr ? 0.6 : 1)})`, fr ? 1 : 2, { chunk: 3 });
        }
        for (let b = 0; b < 48; b++) {
          const v = glowB[(sg > 0 ? 0 : 48) + b]; if (v < 0.05) continue;
          const h = (b + 0.5) * 0.5, la = (ovalLat(h) + 0.5 * ovalWid()) * DEG;
          sc.glow(R.footAt(sg * la, h, r + 0.01), 0.07 + 0.05 * Math.min(3, v), [90, 255, 140], Math.min(0.85, 0.25 + 0.2 * v));
        }
      }
      for (const q of hits) { const a = 1 - q.age / 6; sc.glow(R.footAt(q.lat, q.h, 1 + q.alt / RE + 0.01), q.cusp ? 0.06 : 0.045, colOf(q.alt).split(',').map(Number), 0.9 * a); }
    }
    function caps(sc) {
      for (const sg of [1, -1]) { const cap = []; for (let i = 0; i < 28; i++) { const a = TAU * i / 28, la = 78 * DEG; cap.push([1.003 * Math.cos(la) * Math.cos(a), 1.003 * Math.cos(la) * Math.sin(a), sg * 1.003 * Math.sin(la)]); } sc.poly(cap, { rgb: [225, 236, 245], a: 0.45, shade: false }); }
    }
    // the close-up: the Earth from above the night side, with its ovals (its own small 3-D camera)
    function drawGlobe(c, x, y, s, dtr, running) {
      if (!scG) scG = new CL.V3.Scene({ yaw: -0.5, pitch: 0.78, dist: 3.5, target: [0, 0, 0.15], fov: 40, minDist: 1, maxDist: 10 });
      if (running && !reduceMotion) gYaw += dtr * 0.06;
      scG.yaw = -0.5 + 0.35 * Math.sin(gYaw);
      const tt = performance.now() / 1000;
      c.save(); rrect(c, x, y, s, s, 10); c.clip(); c.translate(x, y);
      scG.begin(c, s, s, { fog: false, backdrop: (g, W2, H2) => { g.fillStyle = '#02040a'; g.fillRect(0, 0, W2, H2); drawSky3d(g, W2, H2, scG, tt, { dim: 0.7 }); } });
      addEarth(scG, SUN); if (!p.nofield) { caps(scG); ovalOn(scG, 1.015); }
      scG.end();
      c.restore();
      c.strokeStyle = 'rgba(214,224,218,0.35)'; c.lineWidth = 1; rrect(c, x + 0.5, y + 0.5, s - 1, s - 1, 10); c.stroke();
      text(c, 'Earth up close', x + 10, y + 14, { size: 12 });
      if (p.nofield) { if (s >= 170) text(c, 'no ovals here:', x + 10, y + s - 27, { size: 11, color: '#ffd590' }); text(c, s >= 170 ? 'no field to guide the wind' : 'no ovals', x + 10, y + s - 12, { size: 11, color: '#ffd590' }); }
      else text(c, `oval down to ${pl(w.latEq, 3)}° · Kp ${pl(w.kp, 2)}`, x + 10, y + s - 12, { size: 11, color: '#9df5b8' });
    }
    function drawImfArrow(addLine, x, y, zh) {
      const up = p.bz >= 0, z0 = up ? -zh : zh, z1 = up ? zh : -zh;
      addLine([x, y, z0], [x, y, z1]);
    }

    /* ---- 3D ---- */
    function draw3d(sc, c, W, H, dtr, running) {
      if (running) age(dtr);
      const tt = performance.now() / 1000, wide = W >= 620, fov = 46;
      const nf = p.nofield, f = 0.5 * Math.min(W * 0.85, H * 1.05) / Math.tan(fov * Math.PI / 360), want = clamp((nf ? (wide ? 12 : 8.5) : (wide ? 74 : 46)) * f / Math.max(160, W * 0.5), nf ? 5 : 40, 260);
      v3s = v3s ? v3s + (want - v3s) * clamp(dtr * 4, 0, 1) : want;
      sc.begin(c, W, H, { dist: v3s, target: nf ? [wide ? 1.6 : 1, 0, 0] : [wide ? 8 : 4, 0, 0], fog: false, fov, lift: wide ? 0 : -0.14, backdrop: (g, W2, H2, hy, S) => {
        g.fillStyle = '#02040a'; g.fillRect(0, 0, W2, H2);
        drawSky3d(g, W2, H2, S, tt);
        const q = skyPoint(S, SUN), dx = v3dot(SUN, S.Rw), dy = -v3dot(SUN, S.Uw), dl = Math.hypot(dx, dy) || 1;
        const on = q && q[0] > -60 && q[0] < W2 + 60 && q[1] > -60 && q[1] < H2 + 60, ex = on ? q[0] : S.cx + dx / dl * W2 * 0.7, ey = on ? q[1] : S.cy + dy / dl * H2 * 0.7;
        glow(g, ex, ey, Math.max(W2, H2) * 0.75, '255,190,110', 0.2);
        if (on) { glow(g, ex, ey, 70, '255,230,180', 0.85); g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(ex, ey, 16, 0, TAU); g.fill(); }
        if (wide) text(g, `Sun: 150 million km away · the wind takes ${fmtDays(w.tTravel)}`, clamp(ex + 10, 12, W2 - 330), clamp(ey, 18, H2 - 40), { size: 12.5, color: 'rgba(255,214,140,0.9)' });
        else text(g, `← Sun · wind ${fmtDays(w.tTravel)} away`, 10, 50, { size: 11.5, color: 'rgba(255,214,140,0.9)' });
      } });
      // bow shock and magnetopause: surfaces of revolution round the Sun–Earth line, drawn as see-through shells
      const shell = (rOf, thMax, rgb, a, lineA, nT = 14, nP = 18) => {
        const P = (th, ph) => { const r = rOf(th); return [-r * Math.cos(th), r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph)]; };
        for (let i = 0; i < nT; i++) for (let j = 0; j < nP; j++) {
          const t0 = thMax * i / nT, t1 = thMax * (i + 1) / nT, p0 = TAU * j / nP, p1 = TAU * (j + 1) / nP;
          sc.poly([P(t0, p0), P(t1, p0), P(t1, p1), P(t0, p1)], { rgb, a, shade: false });
        }
        for (let i = 3; i <= nT; i += 3) { const pts = []; for (let j = 0; j <= 48; j++) pts.push(P(thMax * i / nT, TAU * j / 48)); sc.path(pts, `rgba(${rgb},${lineA})`, 1, { chunk: 4 }); }
        for (let j = 0; j < 8; j++) { const pts = []; for (let i = 0; i <= 30; i++) pts.push(P(thMax * i / 30, TAU * j / 8 + Math.PI / 8)); sc.path(pts, `rgba(${rgb},${lineA * 0.5})`, 1, { chunk: 4 }); }
        return P;
      };
      if (nf) { draw3dBare(sc, c, W, H, dtr, running, shell, tt, wide); return; }
      const thMP = Math.acos(clamp(-60 / R.mpR(w, 2.6), -1, 1)), thB = 2.0;
      const PB = shell(th => R.bsR(w, th), thB, [255, 186, 120], 0.02, 0.16, 9, 16);
      const PM = shell(th => R.mpR(w, Math.min(th, 2.75)), Math.min(2.62, thMP + 0.2), [90, 160, 255], 0.06, 0.2);
      // the plasma sheet in the tail
      sc.poly([[7, -11, 0], [62, -16, 0], [62, 16, 0], [7, 11, 0]], { rgb: [255, 170, 90], a: 0.06, shade: false });
      addEarth(sc, SUN); caps(sc); ovalOn(sc);
      // field lines: closed ones (both ends on Earth) blue, open ones (one end out in the wind) violet
      for (const L of geo.lines) sc.path(L.pts, L.end === 'earth' ? `rgba(140,190,255,${L.h % 12 ? 0.25 : 0.55})` : `rgba(196,140,255,${L.h % 12 ? 0.22 : 0.45})`, 1.1, { chunk: 6 });
      // the Sun's magnetic field, carried by the wind: arrows show which way it points (Bz)
      const zh = 4 + 0.1 * Math.min(40, Math.abs(p.bz)), xs0 = -58, gap = 12, col = p.bz < 0 ? 'rgba(255,120,110,0.6)' : 'rgba(255,214,140,0.55)';
      for (let k = 0; k < 3; k++) {
        const x = xs0 + ((k * gap + imfOff) % (gap * 3));
        if (x > -R.bsR(w, 0) - 2) continue;
        for (const y of [-11, 11]) { const up = p.bz >= 0; sc.arrow([x, y, up ? -zh : zh], [x, y, up ? zh : -zh], col, 1.3, 0.2); }
      }
      if (wide) sc.label([-40, -11, zh + 3], `Sun’s field: Bz = ${pl(p.bz, 3)} nT (${p.bz < 0 ? 'south' : p.bz > 0 ? 'north' : 'sideways'})`, { color: p.bz < 0 ? '#ff9a8a' : '#ffd590' });
      // where the fields join (reconnection): at the nose when the Sun's field points south, and in the tail
      if (p.bz < 0) {
        sc.glow([-w.r0, 0, 0], 12, [255, 120, 110], 0.6 + 0.3 * Math.sin(tt * 3), { px: true });
        if (wide) sc.label([-w.r0, 0, -2.5], 'fields join here', { color: '#ff9a8a', dy: 12, dx: -34 });
        sc.glow([24, 0, 0], 10, [255, 170, 90], 0.5 + 0.3 * Math.sin(tt * 3 + 1), { px: true });
        if (wide) sc.label([24, 0, -2], 'and here: plasma shot back to Earth', { color: '#ffc58a', dy: 10 });
      }
      // labels on the shapes
      sc.label(PB(0.75, -Math.PI / 2), `bow shock · ${pl(w.rbs, 3)} RE`, { color: 'rgba(255,200,140,0.9)', dy: 14 });
      sc.label(PM(0.95, Math.PI / 2), `magnetopause · ${pl(w.r0, 3)} RE`, { color: 'rgba(150,200,255,0.95)' });
      sc.label([46, 0, 13], 'magnetotail', { color: 'rgba(196,160,255,0.9)' });
      if (wide) sc.label([34, 12, 0], 'plasma sheet', { color: 'rgba(255,190,130,0.9)' });
      if (wide && geo.cus[0]) sc.label(geo.cus[0].pts[0], 'cusp', { color: 'rgba(255,150,140,0.9)', dx: 26, dy: -12 });
      if (wide) sc.label([0, 0, -2.4], 'Earth (to scale)', { color: 'rgba(214,224,218,0.85)', dy: 16, dx: 18 });
      // the particles: one dot stands for a great many real ones
      sc.custom([8, 0, 0], g => {
        const E = sc.project([0, 0, 0]), ER = E ? E.k * 1.02 : 0;
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        for (const P of parts) {
          const q = sc.cam([P.x, P.y, P.z]); if (q[2] <= sc.near) continue;
          const s0 = sc.scr(q);
          if (E && q[2] > E.z && Math.hypot(s0[0] - E.x, s0[1] - E.y) < ER) continue;
          const len = P.st === 2 && P.k >= P.ls ? 0.9 : P.st === 0 ? 2.4 : 1.6, q1 = sc.cam([P.x - P.vx * len, P.y - P.vy * len, P.z - P.vz * len]);
          if (q1[2] <= sc.near) continue;
          const s1 = sc.scr(q1);
          g.strokeStyle = P.st === 0 ? 'rgba(255,236,190,0.42)' : P.st === 1 ? 'rgba(255,170,90,0.6)' : P.kind === 'cusp' ? 'rgba(255,110,100,0.95)' : P.k >= P.ls ? 'rgba(110,255,160,0.95)' : 'rgba(120,200,255,0.9)';
          g.lineWidth = P.st === 2 ? 2 : 1.3; g.beginPath(); g.moveTo(s1[0], s1[1]); g.lineTo(s0[0], s0[1]); g.stroke();
        }
        g.restore();
      }, { layer: 'front' });
      sc.end();
      const gs = Math.min(W * (wide ? 0.27 : 0.32), H * (wide ? 0.46 : 0.34), 240);
      drawGlobe(c, W - gs - 12, H - gs - 12, gs, dtr, running);
      drawLegend(c, wide ? 14 : 10, wide ? 16 : 52, wide);
    }
    // the world without Earth's field: what a planet as big as Earth with no field of its own (Venus) looks like
    function draw3dBare(sc, c, W, H, dtr, running, shell, tt, wide) {
      const PB = shell(th => R.bsR(wn, th), 2.0, [255, 186, 120], 0.03, 0.22, 9, 16);
      const PO = shell(th => R.mpR(wn, Math.min(th, 2.3)), 2.25, [120, 200, 255], 0.05, 0.3, 8, 16);
      addEarth(sc, SUN);
      sc.label(PB(0.7, Math.PI / 2), wide ? 'bow shock · about 1,900 km up' : 'bow shock', { color: 'rgba(255,200,140,0.95)', dy: -10 });
      sc.label(PO(1.0, -Math.PI / 2), wide ? 'the wind is held off only about 300 km up' : 'held off 300 km up', { color: 'rgba(160,215,255,0.95)', dy: 16 });
      if (wide) sc.label([7, -1.6, 0], 'air carried away by the wind', { color: 'rgba(150,235,255,0.95)' });
      sc.custom([2, 0, 0], g => {
        const E = sc.project([0, 0, 0]), ER = E ? E.k * 1.02 : 0;
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        const streak = (x, y, z, vx, vy, vz, len, colr, lw) => {
          const q = sc.cam([x, y, z]); if (q[2] <= sc.near) return;
          const s0 = sc.scr(q); if (E && q[2] > E.z && Math.hypot(s0[0] - E.x, s0[1] - E.y) < ER) return;
          const q1 = sc.cam([x - vx * len, y - vy * len, z - vz * len]); if (q1[2] <= sc.near) return;
          const s1 = sc.scr(q1); g.strokeStyle = colr; g.lineWidth = lw; g.beginPath(); g.moveTo(s1[0], s1[1]); g.lineTo(s0[0], s0[1]); g.stroke();
        };
        for (const P of parts) streak(P.x, P.y, P.z, P.vx, P.vy, P.vz, P.st === 0 ? 0.5 : 0.32, P.st === 0 ? 'rgba(255,236,190,0.5)' : 'rgba(255,170,90,0.75)', 1.3);
        for (const q of ions) { const dx = q.x - q.px, dy = q.y - q.py, dz = q.z - q.pz, d = Math.hypot(dx, dy, dz) || 1; streak(q.x, q.y, q.z, dx / d, dy / d, dz / d, Math.min(0.6, 0.12 + d * 2), 'rgba(140,235,255,0.95)', 1.8); }
        g.restore();
      }, { layer: 'front' });
      sc.end();
      const gs = Math.min(W * (wide ? 0.27 : 0.32), H * (wide ? 0.46 : 0.34), 240);
      drawGlobe(c, W - gs - 12, H - gs - 12, gs, dtr, running);
      drawLegend(c, wide ? 14 : 10, wide ? 16 : 52, wide);
    }
    function drawLegend(c, x, y, wide) {
      const it = p.nofield ? [['255,236,190', 'solar wind'], ['255,170,90', 'slowed and heated'], ['140,235,255', 'ions from the air, carried away']]
        : [['255,236,190', 'solar wind'], ['255,170,90', 'slowed and heated'], ['120,200,255', 'got in: tail and plasma sheet'], ['110,255,160', 'sliding down to the oval'], ['255,110,100', 'in through a cusp']];
      if (!wide) { text(c, 'dots: solar-wind plasma', x, y, { size: 11, color: 'rgba(214,224,218,0.75)' }); return; }
      it.forEach(([rgb, s], i) => { c.strokeStyle = `rgba(${rgb},0.95)`; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + i * 17); c.lineTo(x + 14, y + i * 17); c.stroke(); text(c, s, x + 20, y + i * 17, { size: 11.5, color: 'rgba(214,224,218,0.85)' }); });
    }

    /* ---- 2D: the noon–midnight cut ---- */
    function draw2d(c, W, H, dtr, running) {
      if (running) age(dtr);
      if (p.nofield) { draw2dBare(c, W, H, dtr, running); return; }
      const wide = W >= 620, s = Math.min((W - 24) / 112, (H - 40) / 66), cx = 12 + 50 * s, cy = H / 2, P2 = (x, z) => [cx + x * s, cy - z * s];
      c.fillStyle = '#02040a'; c.fillRect(0, 0, W, H); drawStars(c, W, H, performance.now() / 1000);
      glow(c, -40, cy, H * 0.9, '255,190,110', 0.22);
      text(c, `Sun → 150 million km away · ${fmtDays(w.tTravel)} for the wind`, 12, wide ? 18 : 52, { size: 12.5, color: 'rgba(255,214,140,0.9)' });
      const curve = (rOf, thMax) => { c.beginPath(); for (let i = 0; i <= 120; i++) { const th = -thMax + 2 * thMax * i / 120, r = rOf(Math.abs(th)), [x, y] = P2(-r * Math.cos(th), r * Math.sin(th)); i ? c.lineTo(x, y) : c.moveTo(x, y); } };
      curve(th => R.mpR(w, th), 2.45); c.fillStyle = 'rgba(70,130,255,0.07)'; c.fill(); c.strokeStyle = 'rgba(120,190,255,0.75)'; c.lineWidth = 1.6; c.stroke();
      c.setLineDash([6, 5]); curve(th => R.bsR(w, th), 2.0); c.strokeStyle = 'rgba(255,190,130,0.6)'; c.lineWidth = 1.4; c.stroke(); c.setLineDash([]);
      { const [x0, y0] = P2(7, 0.9), [x1, y1] = P2(62, -0.9); c.fillStyle = 'rgba(255,170,90,0.12)'; c.fillRect(x0, y0, x1 - x0, y1 - y0); }
      for (const L of geo.lines) {
        if (L.h !== 0 && L.h !== 12) continue;
        c.strokeStyle = L.end === 'earth' ? 'rgba(140,190,255,0.55)' : 'rgba(196,140,255,0.5)'; c.lineWidth = 1.1; c.beginPath();
        L.pts.forEach((q, i) => { const [x, y] = P2(q[0], q[2]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
      }
      const zh = 6 + 0.12 * Math.min(40, Math.abs(p.bz));
      for (let k = 0; k < 4; k++) { const x = -58 + ((k * 10 + imfOff) % 40); if (x > -R.bsR(w, 0) - 2) continue; const up = p.bz >= 0, [ax, ay] = P2(x, up ? -zh : zh), [bx, by] = P2(x, up ? zh : -zh); arrow2(c, ax, ay, bx, by, p.bz < 0 ? 'rgba(255,120,110,0.8)' : 'rgba(255,214,140,0.7)'); }
      // particles near this cut bright, the rest faint
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const P of parts) {
        const near = Math.abs(P.y) < 9 || P.st === 2, [x, y] = P2(P.x, P.z);
        c.fillStyle = (P.st === 0 ? 'rgba(255,236,190,' : P.st === 1 ? 'rgba(255,170,90,' : P.kind === 'cusp' ? 'rgba(255,110,100,' : P.k >= P.ls ? 'rgba(110,255,160,' : 'rgba(120,200,255,') + (near ? 0.9 : 0.18) + ')';
        c.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      }
      c.restore();
      { const [ex, ey] = P2(0, 0), er = Math.max(2.5, s); c.fillStyle = '#0e1c36'; c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fill(); c.fillStyle = '#4f97d8'; c.beginPath(); c.arc(ex, ey, er, Math.PI / 2, Math.PI * 1.5); c.fill(); const ga = Math.min(1, 0.2 + glowB.reduce((a, b) => a + b, 0) / 30); glow(c, ex, ey - er, 6 + er, '90,255,140', ga); glow(c, ex, ey + er, 6 + er, '90,255,140', ga); text(c, 'Earth', ex, ey + er + 12, { size: 11, align: 'center', color: 'rgba(214,224,218,0.8)' }); }
      if (p.bz < 0) { const [nx, ny] = P2(-w.r0, 0); glow(c, nx, ny, 11, '255,120,110', 0.7); text(c, 'fields join', nx - 6, ny - 14, { size: 11, align: 'right', color: '#ff9a8a' }); const [tx, ty] = P2(24, 0); glow(c, tx, ty, 10, '255,170,90', 0.6); }
      const lab = (s2, x, z, col) => { const [lx, ly] = P2(x, z); text(c, s2, lx, ly, { size: 11.5, color: col }); };
      lab(`bow shock ${pl(w.rbs, 3)} RE`, -R.bsR(w, 0.9) * Math.cos(0.9) - 2, R.bsR(w, 0.9) * Math.sin(0.9) + 1, 'rgba(255,200,140,0.9)');
      lab(`magnetopause ${pl(w.r0, 3)} RE`, -R.mpR(w, 1.2) * Math.cos(1.2) + 1, R.mpR(w, 1.2) * Math.sin(1.2) - 1.5, 'rgba(150,200,255,0.95)');
      lab('magnetotail', 40, 13, 'rgba(196,160,255,0.9)'); lab('plasma sheet', 30, -2.2, 'rgba(255,190,130,0.9)');
      text(c, 'cut through the Sun–Earth line, north up', 12, H - 12, { size: 11, color: 'rgba(214,224,218,0.6)' });
      const gs = Math.min(W * (wide ? 0.27 : 0.36), H * 0.46, 240);
      drawGlobe(c, W - gs - 12, H - gs - 12, gs, dtr, running);
    }
    // the same cut without Earth's field: zoomed in, because everything happens within a few thousand km of the ground
    function draw2dBare(c, W, H, dtr, running) {
      const wide = W >= 620, s = Math.min((W - 24) / 30, (H - 50) / 15), cx = 12 + 13 * s, cy = H / 2, P2 = (x, z) => [cx + x * s, cy - z * s];
      c.fillStyle = '#02040a'; c.fillRect(0, 0, W, H); drawStars(c, W, H, performance.now() / 1000);
      glow(c, -40, cy, H * 0.9, '255,190,110', 0.22);
      text(c, `Sun → 150 million km away · ${fmtDays(w.tTravel)} for the wind`, 12, wide ? 18 : 52, { size: 12.5, color: 'rgba(255,214,140,0.9)' });
      const curve = (rOf, thMax) => { c.beginPath(); for (let i = 0; i <= 120; i++) { const th = -thMax + 2 * thMax * i / 120, r = rOf(Math.abs(th)), [x, y] = P2(-r * Math.cos(th), r * Math.sin(th)); i ? c.lineTo(x, y) : c.moveTo(x, y); } };
      c.setLineDash([6, 5]); curve(th => R.bsR(wn, th), 2.0); c.strokeStyle = 'rgba(255,190,130,0.7)'; c.lineWidth = 1.4; c.stroke(); c.setLineDash([]);
      curve(th => R.mpR(wn, Math.min(th, 2.3)), 2.25); c.strokeStyle = 'rgba(140,205,255,0.8)'; c.lineWidth = 1.4; c.stroke();
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const P of parts) { const near = Math.abs(P.y) < 2.5, [x, y] = P2(P.x, P.z); c.fillStyle = (P.st === 0 ? 'rgba(255,236,190,' : 'rgba(255,170,90,') + (near ? 0.85 : 0.16) + ')'; c.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); }
      for (const q of ions) { const [x, y] = P2(q.x, q.z); c.fillStyle = 'rgba(140,235,255,0.95)'; c.fillRect(x - 1.5, y - 1.5, 3, 3); }
      c.restore();
      { const [ex, ey] = P2(0, 0), er = s; c.fillStyle = '#0e1c36'; c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fill(); c.fillStyle = '#4f97d8'; c.beginPath(); c.arc(ex, ey, er, Math.PI / 2, Math.PI * 1.5); c.fill(); c.strokeStyle = 'rgba(150,200,255,0.45)'; c.lineWidth = 1; c.beginPath(); c.arc(ex, ey, er * 1.047, 0, TAU); c.stroke(); }
      const lab = (s2, x, z, col, al) => { const [lx, ly] = P2(x, z); text(c, s2, lx, ly, { size: 11.5, color: col, align: al || 'left' }); };
      lab('bow shock · about 1,900 km up', -1.2, 1.9, 'rgba(255,200,140,0.95)', 'right');
      lab('wind held off only about 300 km up', -0.2, -1.55, 'rgba(160,215,255,0.95)', 'right');
      lab('air carried away', 6, 0.9, 'rgba(150,235,255,0.95)');
      text(c, 'no magnetic field · cut through the Sun–planet line, north up', 12, H - 12, { size: 11, color: 'rgba(214,224,218,0.6)' });
      const gs = Math.min(W * (wide ? 0.24 : 0.32), H * 0.4, 220);
      drawGlobe(c, W - gs - 12, H - gs - 12, gs, dtr, running);
    }
    function arrow2(c, ax, ay, bx, by, col) {
      c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      const a = Math.atan2(by - ay, bx - ax), h = 6; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - h * Math.cos(a - 0.45), by - h * Math.sin(a - 0.45)); c.moveTo(bx, by); c.lineTo(bx - h * Math.cos(a + 0.45), by - h * Math.sin(a + 0.45)); c.stroke();
    }

    /* ---- the side panel ---- */
    function sideNotes() {
      const sn = $('#rsSwScenNote'); if (sn) sn.textContent = SCEN[p.scen] ? SCEN[p.scen].note : 'Your own solar wind.';
      const vn = $('#rsSwVNote'); if (vn) vn.innerHTML = `Takes <b>${fmtDays(w.tTravel)}</b> to cover the 150 million km from the Sun. Push on Earth’s field: ρv² = <b>${pl(w.Dp, 3)} nPa</b>.`;
      const bn = $('#rsSwBNote'); if (bn) bn.innerHTML = p.bz < 0 ? `South: opposite to Earth’s field at the nose, so the two <b>join</b> (magnetic reconnection) and let energy and particles in. Power going in: <b>${fmtPow(w.eps)}</b>.` : p.bz > 0 ? 'North: the same way as Earth’s field at the nose, so they hardly join. Little gets in: a faint oval far north.' : 'Zero: the Sun’s field lies in the plane of Earth’s orbit here, so it hardly joins.';
      const nn = $('#rsSwNNote'); if (nn) nn.innerHTML = `${pl(w.flux / 1e8, 3)} × 10⁸ particles cross each cm² every second. Denser wind pushes harder: the magnetopause sits at <b>${pl(w.r0, 3)} R<sub>E</sub></b>.`;
    }
    const sim = {
      go: 'Start', speeds: [['60', '60× faster'], ['200', '200× faster'], ['600', '600× faster']], speed0: '200',
      canvasLabel: 'Earth in space with the solar wind coming from the Sun on the left: the bow shock, the magnetopause, Earth’s magnetic field lines stretched into a tail, the particles that get in, and a close-up of the Earth with its two auroral ovals',
      graphs: ['Where the wind is stopped: magnetopause against the wind’s push', 'How far from the pole the aurora reaches: Kp'],
      side() {
        return `<div class="panel"><div class="panel-title">The Sun today</div><div class="chips" id="rs-sw-scen">${Object.entries(SCEN).map(([k, S]) => `<button type="button" class="chip-btn" data-scen="${k}">${S.t}</button>`).join('')}</div><p class="hint" id="rsSwScenNote"></p></div>
          <details class="acc tag-hazard" open><summary><span class="acc-title">Solar wind</span></summary><div class="acc-body">
            ${ctl('sw-v', 'Speed of the wind', 'km/s')}<p class="hint" id="rsSwVNote"></p>
            <div data-level="expert">${ctl('sw-n', 'Particles in each cm³', 'cm⁻³')}<p class="hint" id="rsSwNNote"></p></div></div></details>
          <details class="acc tag-copper" open><summary><span class="acc-title">The Sun’s magnetic field</span></summary><div class="acc-body">
            ${ctl('sw-bz', 'North–south part, Bz', 'nT')}<p class="hint" id="rsSwBNote"></p>
            <p class="hint" data-level="beginner">This is the key! The wind carries the Sun’s magnetic field. When it points <b>south</b> it joins Earth’s field and opens a door; when it points north the door stays almost shut.</p></div></details>`;
      },
      bind(changed) {
        const sync = () => { for (const b of $$('#rs-sw-scen button')) b.classList.toggle('is-on', b.dataset.scen === p.scen); };
        this._sync = sync;
        $('#rs-sw-scen').addEventListener('click', ev => { const b = ev.target.closest('[data-scen]'); if (!b) return; const S = SCEN[b.dataset.scen]; p.scen = b.dataset.scen; p.v = S.v; p.n = S.n; p.bz = S.bz; for (const k in ctls) ctls[k].sync(); changed(); });
        const own = () => { p.scen = ''; };
        ctls.v = range('sw-v', { min: 250, max: 1000, step: 10, get: () => p.v, set: v => { p.v = v; own(); changed(); } });
        ctls.n = range('sw-n', { min: 1, max: 50, step: 0.5, get: () => p.n, set: v => { p.n = v; own(); changed(); } });
        ctls.bz = range('sw-bz', { min: -50, max: 20, step: 0.5, get: () => p.bz, set: v => { p.bz = v; own(); changed(); } });
        sync();
      },
      reset() { reset(); sideNotes(); if (this._sync) this._sync(); },
      step,
      draw(c, W, H, dtr, running) { draw2d(c, W, H, dtr, running); },
      home3d: { yaw: -1.3, pitch: 0.4, dist: 90, target: [8, 0, 0], fov: 46, minDist: 1.5, maxDist: 400 },
      draw3d(sc, c, W, H, dtr, running) { draw3d(sc, c, W, H, dtr, running); },
      clock: () => `t = ${t < 60 ? pl(t, 3) + ' s' : t < 7200 ? pl(t / 60, 3) + ' min' : pl(t / 3600, 3) + ' h'} of solar wind`,
      status() {
        if (p.nofield) return t === 0 ? ['No magnetic field: the wind meets the bare atmosphere', 'is-warn'] : [`${nIon} ions from the air carried away`, 'is-bad'];
        if (t === 0) return [`Solar wind ${pl(p.v, 3)} km/s · Bz ${pl(p.bz, 3)} nT`, ''];
        if (nAur + nCusp === 0) return ['The wind is flowing round Earth’s field', 'is-run'];
        return [`${nAur} dots reached the ovals · ${nCusp} came in through the cusps`, 'is-good'];
      },
      narrate() {
        const southern = p.bz < 0;
        if (p.nofield) {
          const hE = (w.r0 - 1) * RKM, Ef = p.v * 1e3 * w.BT * 1e-9 * 1e3;
          if (simple()) return t === 0 ? `<b>No magnetic field</b>, as on Venus: nothing bends the solar wind away out in space. It flies straight at the planet and is stopped only about <b>300 km</b> above the ground, by the charged top of the atmosphere (with Earth’s field: ${pl(hE, 2)} km). Press <b>Start</b>.`
            : 'The wind now brushes the top of the air, and its electric field drags ions away: the blue dots, most of them down the tail. Mars has no global field and loses about 100 g of air every second like this. And with no field to guide particles to the poles, there are no auroral ovals.';
          return t === 0 ? `With no field of its own, the planet’s only obstacle is its ionosphere: the wind’s push ρv² = ${pl(w.Dp, 3)} nPa is balanced just a few hundred km up (Venus Express: about 300 km at the nose, bow shock about 1,900 km up). With Earth’s field the magnetopause is at r₀ = ${pl(w.r0, 3)} R<sub>E</sub>, ${pl(hE, 2)} km up. Press <b>Start</b>.`
            : `Ions from the top of the atmosphere are picked up by the wind’s own electric field, E = −v × B, here about ${pl(Ef, 2)} mV/m, and carried off: about three quarters down the tail and one quarter in a plume along E (MAVEN at Mars). Mars loses about 100 g of air a second this way. ${nIon} ions carried away in this view so far.`;
        }
        if (simple()) {
          if (t === 0) return `The Sun blows out a <b>wind of protons and electrons</b>, the solar wind: here ${pl(p.v, 3)} km/s, so it needs <b>${fmtDays(w.tTravel)}</b> to reach us. Earth’s magnetic field is in the way. Press <b>Start</b>.`;
          return `Earth’s field bends each wind particle into a tiny circle (only about ${pl(w.rg / 1e3, 2)} km across) with the same force as your cyclotron’s magnet, F = qv × B, so most of the wind <b>cannot get through</b> and flows around. ${southern ? 'The Sun’s field points <b>south</b>, so it joins Earth’s: some particles get in, go round into the tail and slide down field lines to a ring round each pole: <b>the aurora</b>.' : 'The Sun’s field points <b>north</b>, so it hardly joins Earth’s: very little gets in and the aurora is faint. Try moving Bz below zero.'} It reaches down to about <b>${pl(w.latEq, 3)}°</b> from the equator.`;
        }
        const head = `Wind: ${pl(p.v, 3)} km/s and ${pl(p.n, 3)} particles per cm³, a push of ρv² = ${pl(w.Dp, 3)} nPa. `;
        if (t === 0) return head + `It left the Sun ${fmtDays(w.tTravel)} ago (t = d/v). Earth’s field holds it off at the magnetopause, <b>${pl(w.r0, 3)} R<sub>E</sub></b> (${reKm(w.r0)}) towards the Sun, and a bow shock forms in front at ${pl(w.rbs, 3)} R<sub>E</sub>. Press <b>Start</b>.`;
        return head + `Just inside the magnetopause B ≈ ${pl(w.Bmp, 3)} nT, which bends a wind proton into a circle of r = mv/qB ≈ <b>${pl(w.rg / 1e3, 3)} km</b>, about ${pl(w.r0 * RE / w.rg, 2)} times smaller than the magnetosphere: the wind cannot cross the field, so it is slowed and heated at the bow shock and flows around. ${southern ? `The Sun’s field points south, against Earth’s at the nose, so field lines join (<b>reconnection</b>, Dungey 1961): about ${fmtPow(w.eps)} flows in (Akasofu’s ε), plasma is carried over the poles into the tail, shot back towards Earth from a second join in the tail, and slides down field lines into the auroral ovals.` : 'The Sun’s field points north, the same way as Earth’s at the nose, so the fields hardly join and only a little plasma leaks in along the flanks.'} Newell’s formula gives Kp ≈ <b>${pl(w.kp, 2)}</b>, so the aurora reaches down to about <b>${pl(w.latEq, 3)}°</b> magnetic latitude at midnight (NOAA). Near noon some sheath plasma falls straight in through the cusps (about ${pl(w.latCusp, 3)}°) and glows red.`;
      },
      tiles() {
        if (p.nofield) return [
          ['Solar wind', `${pl(p.v, 3)} km/s`, `${pl(p.n, 3)} per cm³ · ${fmtDays(w.tTravel)} from the Sun`],
          ['Wind held off at', '300 km up', `by the charged top of the air · with Earth’s field: ${pl((w.r0 - 1) * RKM, 2)} km`],
          ['Bow shock', '1,900 km up', `about, as at Venus · with Earth’s field: ${pl((w.rbs - 1) * RKM, 2)} km up`],
          ['Aurora', 'no ovals', 'no field to guide particles to the poles'],
        ];
        return [
          ['Solar wind', `${pl(p.v, 3)} km/s`, `${pl(p.n, 3)} per cm³ · ${fmtDays(w.tTravel)} from the Sun`],
          ['Magnetopause', `${pl(w.r0, 3)} RE`, `${reKm(w.r0)} · pushed by ${pl(w.Dp, 3)} nPa`],
          ['Power going in', fmtPow(w.eps), `Akasofu ε · Bz ${pl(p.bz, 3)} nT`],
          ['Aurora reaches', `${pl(w.latEq, 3)}°`, `magnetic latitude · Kp ≈ ${pl(w.kp, 2)}`],
        ];
      },
      graphA(cv) {
        const xs = [], pts = []; for (let i = 0; i <= 80; i++) { const Dp = Math.pow(10, -0.6 + 2.3 * i / 80); xs.push(Dp); pts.push([Dp, R.solarWind({ v: 400, n: Dp / (1.6726e-6 * 160000), bz: p.bz }).r0]); }
        const r = plot(cv, { xmin: 0.25, xmax: 50, xlog: true, ymin: 4, ymax: 16, xlabel: 'push of the wind ρv² (nPa)', ylabel: 'magnetopause (RE)', pad: { r: 16 }, series: [{ pts, color: '#7db8ff', width: 2.2 }] });
        if (!r) return;
        const c = r.ctx, y6 = Math.round(r.YP(6.6)) + 0.5;
        c.strokeStyle = 'rgba(255,214,140,0.45)'; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(r.pad.l, y6); c.lineTo(r.W - r.pad.r, y6); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(255,214,140,0.85)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText('geostationary satellites, 6.6 RE', r.pad.l + 6, y6 - 2);
        const x = r.XP(clamp(w.Dp, 0.25, 50)), y = r.YP(clamp(w.r0, 4, 16)); glow(c, x, y, 10, '255,214,140', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
      },
      graphB(cv) {
        const pts = R.KP_LAT.map((la, k) => [k, la]);
        const r = plot(cv, { xmin: 0, xmax: 9, ymin: 45, ymax: 70, xlabel: 'Kp (0 quiet … 9 extreme storm)', ylabel: 'aurora reaches (° mag. lat.)', pad: { r: 16 }, series: [{ pts, color: '#7dffb0', width: 2.2 }] });
        if (!r) return;
        const c = r.ctx, x = r.XP(w.kp), y = r.YP(w.latEq); glow(c, x, y, 10, '125,255,176', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
        c.fillStyle = 'rgba(214,224,218,0.75)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('NOAA: edge of the oval at local midnight', r.W - r.pad.r - 4, r.pad.t + 4);
      },
      numbers() {
        const g = R.solarWind(p);
        let h = sec('The solar wind');
        h += row('Time from the Sun', fmtDays(g.tTravel), 'The Sun is 150 million km (1 AU) away; the wind keeps an almost steady speed on the way.', `t = d/v = 1.496 × 10¹¹ m / ${pl(p.v * 1e3, 4)} m/s = ${pl(g.tTravel, 4)} s`);
        h += row('Particles arriving', `${pl(g.flux / 1e8, 3)} × 10⁸ per cm² per second`, 'Mostly protons and electrons (about 95 % of the ions are protons).', `flux = n·v = ${pl(p.n, 3)} cm⁻³ × ${pl(p.v * 1e5, 3)} cm/s`);
        h += row('Its push (dynamic pressure)', `${pl(g.Dp, 3)} nPa`, 'Like wind on a sail: mass per volume times speed squared.', `ρv² = n·m<sub>p</sub>·v² = ${pl(p.n * 1e6, 3)} m⁻³ × 1.673 × 10⁻²⁷ kg × (${pl(p.v * 1e3, 4)} m/s)² = ${CL.e(g.Dp * 1e-9, 3)} Pa`);
        h += sec('Where Earth’s field stops it');
        h += row('Magnetopause, towards the Sun', `${pl(g.r0, 3)} R<sub>E</sub> = ${reKm(g.r0)}`, 'Shue et al. (1998): a formula fitted to hundreds of spacecraft crossings. A southward field (Bz < 0) peels field away and pulls it closer.', `r₀ = (10.22 + 1.29 tanh(0.184(B<sub>z</sub> + 8.14)))·D<sub>p</sub><sup>−1/6.6</sup> = (10.22 + 1.29 tanh(0.184 × ${pl(p.bz + 8.14, 3)})) × ${pl(g.Dp, 3)}<sup>−0.152</sup>`);
        h += row('Check: pressure balance', `${pl(g.rCF, 3)} R<sub>E</sub>`, 'Where the field’s magnetic pressure B²/2μ₀ equals the wind’s push. Currents on the magnetopause double the field there, B = 2B₀/r³.', `(2B₀/r³)²/2μ₀ = ρv²  →  r = (2B₀²/μ₀ρv²)<sup>1/6</sup> = (2 × (3.0 × 10⁻⁵ T)² / (4π × 10⁻⁷ × ${CL.e(g.Dp * 1e-9, 3)} Pa))<sup>1/6</sup>`);
        h += row('Shape of the magnetopause', `flaring α = ${pl(g.alpha, 3)}`, 'Wider towards the night side: the tail.', 'r(θ) = r₀·(2/(1 + cos θ))<sup>α</sup>, α = (0.58 − 0.007B<sub>z</sub>)(1 + 0.024 ln D<sub>p</sub>)');
        h += row('Bow shock', `${pl(g.rbs, 3)} R<sub>E</sub>`, 'The wind is faster than any wave in it, so a shock forms in front, like the bow wave of a ship. Behind it the wind is slower and hotter (the magnetosheath).', `Jelínek et al. (2012): r<sub>bs</sub> = 15.02·D<sub>p</sub><sup>−1/6.55</sup>`);
        h += sec('Why it cannot just come in: F = qv × B');
        h += row('Field just inside the nose', `${pl(g.Bmp, 3)} nT`, 'Earth’s dipole there, doubled by the magnetopause currents.', `B = 2B₀/r₀³ = 2 × 30,000 nT / ${pl(g.r0, 3)}³`);
        h += row('Circle of a wind proton there', `${pl(g.rg / 1e3, 3)} km`, `The magnetosphere is ${reKm(g.r0)} across to the nose: ${pl(g.r0 * RE / g.rg, 2)} times bigger. Charged particles cannot cross a field that bends them this tightly; they gyrate round it and the plasma flows around.`, `r = mv/qB = 1.673 × 10⁻²⁷ kg × ${pl(p.v * 1e3, 4)} m/s / (1.602 × 10⁻¹⁹ C × ${pl(g.Bmp, 3)} × 10⁻⁹ T)`);
        h += row('Circles per second there', `${pl(R.C.e * g.Bmp * 1e-9 / (TAU * R.C.mp), 3)} Hz`, 'Your cyclotron’s formula again; in a 1 T magnet the same proton would circle 15 million times a second.', 'f = qB/2πm');
        h += sec('The door: reconnection');
        h += row('Power going in', fmtPow(g.eps), 'Akasofu’s ε: an estimate of the energy the wind feeds into the magnetosphere. About 10¹¹ W (100 GW) drives substorms; above 10¹² W, storms. Zero when the Sun’s field points north.', `ε = (4π/μ₀)·v·B²·sin⁴(θ/2)·l₀², l₀ = 7 R<sub>E</sub>; clock angle θ = ${pl(g.th / DEG, 3)}°`);
        h += row('Rate the fields join', `${pl(g.dphi, 4)}`, 'Newell et al. (2007): how fast field lines are opened at the nose, in their units ((km/s)<sup>4/3</sup> nT<sup>2/3</sup>).', 'dΦ/dt = v<sup>4/3</sup>·B<sub>T</sub><sup>2/3</sup>·sin<sup>8/3</sup>(θ/2)');
        h += sec('How far from the pole the aurora comes');
        h += row('Kp, the planetary activity index', pl(g.kp, 2) + (g.kpRaw > 9 ? ' (off the scale: Kp stops at 9)' : ''), 'Newell et al. (2008) fitted Kp to the solar wind (correlation 0.87): an estimate, not a measurement.', `Kp = 0.05 + 2.244 × 10⁻⁴·dΦ/dt + 2.844 × 10⁻⁶·n<sup>1/2</sup>·v² = ${pl(g.kpRaw, 3)}`);
        h += row('Edge of the oval at midnight', `${pl(g.latEq, 3)}° magnetic latitude`, 'From NOAA’s table of Kp against the edge of the aurora (66° for Kp 0 … 48° for Kp 9), between table values in a straight line.', '');
        h += row('Cusp aurora at noon', `about ${pl(g.latCusp, 3)}°`, 'Sheath plasma falls straight in through the cusps; these electrons have little energy (under about 1 keV), stop high up and make red light (630 nm). Drawn at 78° when quiet, lower when disturbed.', '');
        h += sec('How the picture is made');
        h += row('Field lines', 'a simple model', 'Earth’s dipole, an image dipole on the Sun side that squeezes the day side (Chapman–Ferraro), and a current sheet in the tail that stretches the night side. The shapes are right in kind, not exact.', '');
        h += row('The dots', 'tracers', 'Each dot stands for a great many particles. The flow round the magnetopause is drawn as flow past a blunt body; how many dots get in follows Newell’s rate. The slide down a field line takes about a second in reality; it is drawn slower so you can see it.', '');
        return h;
      },
      check() {
        const q0 = R.solarWind({ v: 400, n: 5, bz: 0 }), qs = R.solarWind({ v: 750, n: 20, bz: -45 }), quiet = R.solarWind({ v: 350, n: 4, bz: 3 });
        let h = `<p class="hint">The formulas used here against what spacecraft and ground stations measure.</p>`;
        h += cmpTable([
          ['Magnetopause towards the Sun (400 km/s, 5 cm⁻³)', `${pl(q0.r0, 3)} R<sub>E</sub> (Shue); ${pl(q0.rCF, 3)} R<sub>E</sub> (pressure balance)`, 'average of hundreds of crossings: 11.0 R<sub>E</sub>', 'fair', 'good'],
          ['Bow shock towards the Sun', `${pl(q0.rbs, 3)} R<sub>E</sub>`, 'average: 14.6 R<sub>E</sub>', 'fair', 'good'],
          ['Usual wind speed and density', '400 km/s, 5 per cm³ (default)', 'about 400 km/s; about 5 per cm³', 'sw', 'good'],
          ['Quiet aurora', `Kp ${pl(quiet.kp, 2)} → ${pl(quiet.latEq, 3)}°`, 'Kp 0: 66° or higher, Kp 1: 64.5° (NOAA); about 67° near midnight when activity is low', 'kptab', 'good'],
          ['Storm of 10–11 May 2024 (750 km/s, Bz −45 nT)', `Kp formula ${pl(qs.kpRaw, 3)} → 9; aurora to ${pl(qs.latEq, 3)}°`, 'Kp 9 (G5), aurora seen far from the poles', 'may24', 'good'],
          ['Magnetopause in that storm', `${pl(qs.r0, 3)} R<sub>E</sub>`, 'strong storms can push it inside geostationary orbit (6.6 R<sub>E</sub>)', 'mp2025', qs.r0 < 6.6 ? 'good' : 'warn'],
          ['Cusp aurora', `about ${pl(w.latCusp, 3)}°, red`, 'cusp particles at 77–78° near noon; red 630 nm from direct sheath precipitation', 'cusplat', 'good'],
        ]);
        h += `<p class="hint">Simplified: no tilt of Earth’s axis, a steady wind, the field lines from a simple model, and dots that follow the main paths rather than every particle’s own history.</p>`;
        return h;
      },
      keyNumbers() {
        return (p.nofield ? row('With no magnetic field', 'held off about 300 km up', 'As at Venus: only the charged top of the atmosphere stops the wind, and the wind slowly carries air away.') : '') + row('Time from the Sun', fmtDays(w.tTravel), `At ${pl(p.v, 3)} km/s the wind needs this long for 150 million km: t = d/v.`)
          + row('Where Earth’s field stops it', `${pl(w.r0, 3)} Earth radii`, `That is ${reKm(w.r0)} towards the Sun: the magnetopause.`)
          + row('Circle of a wind proton', `${pl(w.rg / 1e3, 3)} km`, `r = mv/qB, your cyclotron’s formula, with Earth’s ${pl(w.Bmp, 3)} nT there: tiny next to the magnetosphere, so the wind flows around.`)
          + row('Power going in', fmtPow(w.eps), p.bz < 0 ? 'The Sun’s field points south and joins Earth’s.' : 'Almost nothing: the Sun’s field does not point south.')
          + row('Aurora reaches', `${pl(w.latEq, 3)}°`, `Magnetic latitude at midnight for Kp ≈ ${pl(w.kp, 2)} (0 quiet, 9 extreme).`);
      },
      link(sm) {
        const lab = labNow(), Bmp = w.Bmp * 1e-9, fmp = R.C.e * Bmp / (TAU * R.C.mp);
        const rows = [
          ['Particle', lab ? `${lab.part.name} (${lab.part.symbol})` : 'proton', 'protons and electrons of the solar wind'],
          ['Magnetic field', lab ? `${fmtB(lab.B)} from your electromagnet` : 'about 1 T', `Earth’s: ${fmtB(Bmp)} at the magnetopause`],
          ['Circle, r = mv/qB', lab ? `up to R = ${pl(lab.R, 3)} m` : '–', `${pl(w.rg / 1e3, 3)} km for a ${pl(p.v, 3)} km/s proton`],
          ['Circles per second, f = qB/2πm', lab ? si(lab.fc, 'Hz', 3) : '–', `${pl(fmp, 3)} Hz`],
        ];
        if (!sm) rows.push(['What the circling does', 'keeps the proton inside the dees until it is fast enough to leave', 'keeps the wind out: it can only gyrate round the field and flow past'], ['How energy gets in', 'the dees’ electric field at the gap', 'where the Sun’s field joins Earth’s (reconnection), then electric fields along B speed electrons into the air']);
        return {
          title: 'How is the aurora like your cyclotron?',
          text: sm ? `Your cyclotron’s magnet bends protons into circles, r = mv/qB. <b>Earth’s field does the same to the solar wind</b>: the circles are small next to the magnetosphere, so the wind is turned aside and flows around. Only where the Sun’s field joins Earth’s can some of it get in and slide down to the poles, where it lights the sky.`
            : `The same Lorentz force, F = qv × B, everywhere. In your cyclotron it keeps the protons on circles inside the dees; at the magnetopause it bends wind protons on circles of about ${pl(w.rg / 1e3, 3)} km, far smaller than the ${reKm(w.r0)} magnetosphere, so the plasma cannot cross the field and flows around it. Energy and particles get in where field lines from the Sun join Earth’s (reconnection). Inside, each particle circles its field line at f = |q|B/2πm as it slides to the poles: version 1 of this simulation follows one of them.`,
          cols: ['Your cyclotron', 'Earth and the solar wind'], rows, alt: 'Animation: on the left your cyclotron’s spiral, on the right solar-wind particles flowing round Earth’s magnetic bubble',
          draw: (c, W, H, t2) => twoPanels(c, W, H, t2, panelCyclo('the magnet bends it into circles'), (c2, w2, h2, t3) => {
            const ex = w2 * 0.55, ey = h2 * 0.55, rb = Math.min(w2, h2) * 0.18;
            c2.strokeStyle = 'rgba(120,190,255,0.8)'; c2.lineWidth = 1.6; c2.beginPath();
            for (let i = 0; i <= 60; i++) { const th = -2.4 + 4.8 * i / 60, r = rb * Math.pow(2 / (1 + Math.cos(th)), 0.6), x = ex - r * Math.cos(th), y = ey - r * Math.sin(th); if (x > w2 + 10) continue; i ? c2.lineTo(x, y) : c2.moveTo(x, y); } c2.stroke();
            c2.fillStyle = '#4f97d8'; c2.beginPath(); c2.arc(ex, ey, 4, 0, TAU); c2.fill();
            for (let k = 0; k < 9; k++) { const b0 = (k - 4) / 4 * rb * 1.9; for (let m = 0; m < 4; m++) { const s2 = ((t3 * 0.35 + m / 4 + k * 0.13) % 1); let x = -rb * 2.2 + s2 * (w2 + rb * 2.2), y0 = b0; const dx = x - ex, r2 = Math.max(rb * rb * 0.6, dx * dx + y0 * y0); const push = rb * rb / r2; const y = ey + y0 * (1 + 0.9 * push * Math.max(0, 1 - Math.abs(dx) / (rb * 3))); if (Math.abs(y - ey) < rb * 0.9 && Math.abs(dx) < rb) continue; glow(c2, x, y, 4, '255,214,150', 0.8); } }
            text(c2, 'Earth and the solar wind', 10, 15, { size: 13 });
            text(c2, `B ≈ ${pl(w.Bmp, 3)} nT · r ≈ ${pl(w.rg / 1e3, 3)} km`, 10, 33, { size: 12, color: '#9df5b8' });
            text(c2, 'the wind is turned aside, round the field', 10, h2 - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
          }),
        };
      },
      sources: ['sw', 'msfc', 'brit', 'shue', 'jel', 'fair', 'mpwiki', 'newell', 'kptab', 'swpctips', 'aka', 'may24', 'mp2025', 'cusp', 'cusplat'],
      whySources: ['venus', 'maven', 'q1989', 'starlink', 'solar1', 'dscovr', 'gscale'],
      get without() { return p.nofield; },
      setWithout(b) { p.nofield = !!b; },
      why(sm) {
        const hE = (w.r0 - 1) * RKM, warn = Math.round(R.warnTime(p.v) / 60);
        return {
          q: 'Why does the aurora matter to us?',
          a: sm ? 'The Sun blows a wind of charged particles at us all the time. Earth’s magnetic field bends them away, with the same force as your cyclotron’s magnet, and holds the wind off about 60,000 km out. Only a trickle gets in near the poles, and that is the aurora. Mars has no such shield, and the wind strips about 100 g of its air every second.'
            : 'Solar-wind ions feel F = qv × B in Earth’s field, so the wind is held off where its push ρv² meets the field’s magnetic pressure, about 10 Earth radii out. Energy gets in mainly where the two fields join, and it lights the ovals. A planet with no field, like Venus, holds the wind off only about 300 km up with its charged upper air, and Mars loses about 100 g of air a second to the wind (MAVEN).',
          metric: 'Where the solar wind is stopped, height above the ground',
          pick: true,
          rows: [
            { k: 'off', label: 'No magnetic field (like Venus)', v: R.NOFIELD.stop / 1e3, txt: 'about 300 km', cur: p.nofield },
            { k: 'on', label: 'Earth’s magnetic field (this wind)', v: hE, txt: `${pl(hE, 2)} km`, cur: !p.nofield },
          ],
          verdict: `Even with Earth’s shield, storms can black out power grids, so a satellite 1.5 million km towards the Sun measures the wind first: at ${pl(p.v, 3)} km/s it reaches us <b>about ${warn} minutes</b> later${warn > 60 ? ' (a storm’s faster wind gives 15 to 60 minutes)' : ''}.`,
        };
      },
      helps() {
        const warn = Math.round(R.warnTime(p.v) / 60), G = ['', 'G1 minor', 'G2 moderate', 'G3 strong', 'G4 severe', 'G5 extreme'], gl = w.kp >= 5 ? Math.min(5, Math.floor(w.kp) - 4) : 0;
        const fx = ['', 'weak power-grid swings; aurora at high latitudes.', 'voltage alarms in high-latitude grids; aurora down to about 55° magnetic latitude.', 'grid voltages may need correcting; satellite navigation and radio can drop out at times; aurora to about 50° magnetic latitude.', 'possible widespread grid voltage problems; satellite navigation degraded for hours; aurora to about 45° magnetic latitude.', 'grids can collapse and transformers be damaged; HF radio can be out for one to two days and satellite navigation degraded for days; aurora to about 40° magnetic latitude.'];
        const L = [
          ['bolt', 'Power grids', 'Storms drive currents into long power lines. On 13 March 1989 they tripped Quebec’s grid: six million people without power for nine hours.', 'q1989'],
          ['sat', 'Satellites', 'Storms heat and swell the upper air. In February 2022 a minor one dragged down 38 of 49 new Starlink satellites.', 'starlink'],
          ['clock', 'Warnings', `NOAA’s SOLAR-1 satellite, 1.5 million km towards the Sun, measures the wind first: at ${pl(p.v, 3)} km/s it reaches Earth about ${warn} minutes later, time to protect grids and satellites.`, 'solar1'],
          ['planet', 'A planet without a shield', 'Mars has no global magnetic field: the solar wind strips away about 100 g of its air every second.', 'maven'],
        ];
        if (gl && !p.nofield) L.splice(2, 0, ['shield', `This wind: Kp ${pl(w.kp, 2)}, a ${G[gl]} storm`, `NOAA’s scale for it: ${fx[gl]}`, 'gscale']);
        return L;
      },
    };
    return sim;
  }
  // the aurora has two versions: one particle up close, or the whole picture from the Sun
  /* =====================================================================
     PET medicine: a hospital cyclotron fires protons into oxygen-18 water and makes fluorine-18. It is turned into a
     sugar (FDG), driven to the hospital and given to patients, all the time decaying with a 110-minute half-life.
     ===================================================================== */
  function makePET() {
    const P = R.PET, MEV = 1.602176634e-13, MCI = 3.7e7;
    const MACH = {
      yours: { t: 'Your cyclotron', sub: 'from the Cyclotron station', E: null, I: 30 },
      dharmais: { t: 'RS Kanker Dharmais', sub: 'Jakarta · 11 MeV', E: 11, I: 30, note: 'Indonesia’s national cancer hospital in Jakarta makes fluorine-18 every day with an 11 MeV Eclipse cyclotron. Measured: 395 mCi (14.6 GBq) after 20 minutes at 30 µA.' },
      decy: { t: 'DECY-13', sub: 'BRIN · 13 MeV', E: 13, I: 30, note: 'The 13 MeV cyclotron Indonesia’s nuclear agency (now BRIN) is building in Yogyakarta, so hospitals depend less on imported isotopes. Its designers worked out the same yield as this simulation: 1223 mCi after 40 minutes at 30 µA.' },
      pettrace: { t: 'GE PETtrace', sub: 'hospital · 16.5 MeV', E: 16.5, I: 55, note: 'A common hospital machine: an H⁻ cyclotron for 16.5 MeV protons. At the University of Michigan one made 1330 mCi (49 GBq) of fluorine-18 in 22 minutes at 55 µA.' },
      mrccc: { t: 'MRCCC Siloam', sub: 'Jakarta · 18 MeV', E: 18, I: 37, note: 'An 18 MeV IBA Cyclone 18/9 at the MRCCC Siloam hospital in Jakarta. Measured: 1961 mCi (72.6 GBq) after 40 minutes at 37 µA.' },
    };
    const p = { m: 'dharmais', I: 30, tbMin: 60, tdMin: 30, eff: 60 };
    const FAR = 300, FAR_MIN = 180;                    // the "without" world: the nearest cyclotron is in another city, 5 hours away
    let tdNear = 30;
    const ctls = {};
    let run = null, t = 0, flashes = [], spin = 0, vanX = 0, lastPat = -1, v3s = null;
    const lab = () => labNow();
    function energy() {
      if (p.m !== 'yours') return MACH[p.m].E;
      const L = lab(); if (!L || !L.part || L.part.key !== 'proton') return 0;
      return L.Kmax / MEV;
    }
    const yoursWhy = () => { const L = lab(); if (!L) return 'Open the Cyclotron station first.'; if (!L.part || L.part.key !== 'proton') return `Your cyclotron is set to accelerate ${L.part ? L.part.name.toLowerCase() + 's' : 'other particles'}; this reaction needs protons. Pick the proton in the Cyclotron station.`; const E = L.Kmax / MEV; return E < P.eth ? `Your protons reach only ${pl(E, 3)} MeV: below the 2.57 MeV threshold of ¹⁸O(p,n)¹⁸F, so no fluorine-18 at all. Make B or R bigger.` : `Your protons leave with ${pl(E, 3)} MeV (K = (qBR)²/2m with ${fmtB(L.B)} and R = ${pl(L.R, 3)} m). ${E >= 10.5 ? 'That is in the range hospital cyclotrons use (11–18 MeV).' : 'Enough to make some fluorine-18, but hospitals use 11–18 MeV: the yield grows steeply with energy (compare the machines above).'}`; };
    const GBq = A => A >= 1e9 ? `${pl(A / 1e9, 3)} GBq` : A >= 1e6 ? `${pl(A / 1e6, 3)} MBq` : `${pl(A / 1e3, 3)} kBq`;
    const mCi = A => `${pl(A / MCI, 3)} mCi`;
    const hm = s => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
    function compute() { run = R.petRun({ E: energy(), I: p.I, tb: p.tbMin * 60, eff: p.eff / 100, td: p.tdMin * 60 }); }
    const endT = () => (run.pats.length ? run.pats[run.pats.length - 1].t + P.slot : run.t3 + 1800);
    const phase = () => t <= 0 ? 'ready' : t < run.t1 ? 'beam' : t < run.t2 ? 'synth' : t < run.t3 ? 'drive' : t < endT() ? 'clinic' : 'done';
    const patNow = () => { let k = -1; for (let i = 0; i < run.pats.length; i++) if (t >= run.pats[i].t) k = i; return k; };
    function reset() { compute(); t = 0; flashes = []; lastPat = -1; }
    function step(dts) {
      t = Math.min(endT(), t + dts);
      const k = patNow(); if (k !== lastPat) { lastPat = k; if (k >= 0 && audio.tick) audio.tick(); }
      return t >= endT();
    }

    /* ---- 3D: the cyclotron vault, the road and the hospital with its PET scanner, at dusk ---- */
    const BX = -7, BY = 0.8, HX0 = 13.8, RY = -2.5;                     // vault centre, hospital centre, the road
    const CX = -8.3, CY = 1.0, TX = -5.0, TY = 1.0, KX = -4.6, KY = 2.85, SX = 13.4, SY = 1.4, SZ = 1.05;
    let skyline = null, camF = null;
    function drawSkyline(g, W, H, hy) {              // a far city on the horizon, with lit windows
      if (hy <= 4 || hy >= H) return;
      if (!skyline || skyline.W !== W) { skyline = { W, b: [] }; let x = -10; let i = 0; while (x < W + 10) { const w = 10 + hash(i * 3.1) * 26, h = 6 + Math.pow(hash(i * 7.7), 2.2) * 46; skyline.b.push([x, w, h, i]); x += w + 2 + hash(i * 1.3) * 10; i++; } }
      const s = Math.min(1, H / 520);
      for (const [x, w, h, i] of skyline.b) {
        const hh = h * s; g.fillStyle = h > 30 ? '#1c2240' : '#262a4a'; g.fillRect(x, hy - hh, w, hh);
        for (let yy = hy - hh + 4; yy < hy - 3; yy += 6) for (let xx = x + 3; xx < x + w - 3; xx += 5) if (hash(xx * 0.37 + yy * 1.91 + i) > 0.78) { g.fillStyle = `rgba(255,${200 + Math.round(40 * hash(xx + yy))},140,${0.25 + 0.35 * hash(yy + i)})`; g.fillRect(xx, yy, 1.6, 2.2); }
        if (h > 40 && hash(i * 9.1) > 0.5) { g.fillStyle = `rgba(255,60,60,${0.5 + 0.5 * Math.sin(performance.now() / 500 + i)})`; g.fillRect(x + w / 2 - 1, hy - hh - 3, 2, 2); }
      }
    }
    const room = (sc, cx, cy, floorRgb, wallRgb, sideX) => {
      sc.box([cx, cy, 0.06], [3.7, 2.7, 0.06], { rgb: floorRgb, amb: 0.62, spec: 0.05 });
      sc.box([cx, cy + 2.85, 0.95], [3.85, 0.15, 0.95], { rgb: wallRgb, amb: 0.55 });
      sc.box([sideX, cy, 0.95], [0.15, 2.7, 0.95], { rgb: wallRgb.map(v => v * 0.92), amb: 0.55 });
    };
    function draw3d(sc, c, W, H, dtr, running) {
      const tt = performance.now() / 1000, ph = phase(), A = run.activity(Math.max(0, t)), wide = W >= 620;
      // the camera follows the medicine: the vault while the beam is on, the van on the road, then the scanner
      const f = 0.5 * Math.min(W * 0.85, H * 1.05) / Math.tan(46 * Math.PI / 360), span = s => clamp(s / (W / f), 7, 80);
      const k0 = ph === 'drive' ? (t - run.t2) / Math.max(1, run.t3 - run.t2) : 0;
      const goal = ph === 'beam' || ph === 'synth' ? [-6.4, span(wide ? 18 : 12)] : ph === 'drive' ? [0.4 + 9.2 * k0, span(wide ? 25 : 15)] : ph === 'clinic' ? [13.7, span(wide ? 18 : 12)] : [3.6, span(33)];
      if (!camF) camF = goal.slice();
      const kk = clamp(dtr * 2.2, 0, 1); camF[0] += (goal[0] - camF[0]) * kk; camF[1] += (goal[1] - camF[1]) * kk;
      sc.begin(c, W, H, { dist: camF[1], target: [camF[0], 0.6, 0.5], lift: wide ? 0.05 : 0.02, bg: [40, 40, 62], fogNear: 1.1, fogFar: 3.2, fogMax: 0.6,
        backdrop: (g, W2, H2, hy) => { drawBlueHour(g, W2, H2, hy, tt); drawSkyline(g, W2, H2, hy); } });
      sc.poly([[-60, -40, 0], [70, -40, 0], [70, 40, 0], [-60, 40, 0]], { rgb: [30, 38, 36], shade: false, layer: 'back' });
      // the road, with its centre line and kerbs
      sc.poly([[-12, RY - 0.75, 0.01], [19, RY - 0.75, 0.01], [19, RY + 0.75, 0.01], [-12, RY + 0.75, 0.01]], { rgb: [46, 50, 56], shade: false, layer: 'back' });
      for (let x = -11.5; x < 18.5; x += 1.3) sc.poly([[x, RY - 0.04, 0.02], [x + 0.65, RY - 0.04, 0.02], [x + 0.65, RY + 0.04, 0.02], [x, RY + 0.04, 0.02]], { rgb: [236, 204, 96], a: 0.85, shade: false, layer: 'back' });
      for (const k of [-1, 1]) sc.poly([[-12, RY + k * 0.75, 0.02], [19, RY + k * 0.75, 0.02], [19, RY + k * 0.8, 0.02], [-12, RY + k * 0.8, 0.02]], { rgb: [150, 156, 160], shade: false, layer: 'back' });
      // the vault: thick concrete stops the neutrons and gamma rays the beam makes
      room(sc, BX, BY, [118, 122, 120], [150, 150, 144], BX - 3.85);
      sc.pool([CX + 1.2, CY, 0.13], 3, 2.2, [120, 200, 255], ph === 'beam' ? 0.16 : 0.05);
      sc.shadow([CX, CY, 0.13], 1.6, 1.6, 0.35);
      const beam = ph === 'beam';
      // the cyclotron: an iron magnet with its upper half lifted on jacks, so the dees and the beam's spiral show
      const yoke = { rgb: [48, 94, 140], amb: 0.55, spec: 0.35, shin: 26 };
      sc.cyl([CX, CY, 0.12], [CX, CY, 0.78], 1.45, yoke, 36);
      sc.cyl([CX, CY, 1.78], [CX, CY, 2.32], 1.45, yoke, 36);
      for (const a of [0.55, 2.2, 3.85, 5.5]) sc.cyl([CX + 1.22 * Math.cos(a), CY + 1.22 * Math.sin(a), 0.78], [CX + 1.22 * Math.cos(a), CY + 1.22 * Math.sin(a), 1.78], 0.07, { rgb: [190, 196, 200], spec: 0.6, flat: true }, 8);
      for (const s2 of [-1, 1]) { const pts = []; for (let i = 0; i <= 18; i++) { const a = -Math.PI / 2 + Math.PI * i / 18; pts.push([CX + s2 * (0.05 + 1.08 * Math.cos(a)), CY + 1.08 * Math.sin(a), 0.8]); } sc.poly(pts, { rgb: [196, 142, 84], amb: 0.7, spec: 0.5, shin: 30, out: [0, 0, 1] }); }
      if (beam && !reduceMotion) spin += dtr * 2.2;
      { const pts = []; for (let i = 0; i <= 260; i++) { const u = i / 260, a = u * 8 * TAU, r = 0.07 + 0.98 * Math.sqrt(u); pts.push([CX + r * Math.cos(a), CY + r * Math.sin(a), 0.83]); }
        sc.path(pts, `rgba(130,225,255,${beam ? 0.85 : 0.22})`, beam ? 1.6 : 1.1, { chunk: 6, glow: beam ? 'rgba(120,220,255,0.6)' : null });
        if (beam) for (let k = 0; k < 3; k++) { const u = (spin + k / 3) % 1, a = u * 8 * TAU, r = 0.07 + 0.98 * Math.sqrt(u); sc.glow([CX + r * Math.cos(a), CY + r * Math.sin(a), 0.86], 8, [170, 238, 255], 0.95, { px: true, core: true }); } }
      // the beam line and the target: water made with oxygen-18 behind a thin metal window
      const glowA = clamp(A / Math.max(run.Asat, 1), 0, 1);
      sc.cyl([CX + 1.45, CY, 0.83], [TX - 0.22, TY, 0.83], 0.07, { rgb: [176, 182, 186], spec: 0.6, shin: 30 }, 10);
      if (beam) sc.line([CX + 1.1, CY, 0.83], [TX - 0.22, TY, 0.83], 'rgba(150,235,255,0.95)', 2.6, { glow: 'rgba(140,230,255,0.85)' });
      sc.cyl([TX - 0.22, TY, 0.83], [TX + 0.26, TY, 0.83], 0.27, { rgb: [158, 166, 172], spec: 0.5, shin: 30 }, 18);
      if (ph !== 'ready' && (ph === 'beam' || ph === 'synth')) sc.glow([TX, TY, 0.83], 0.45 + 0.7 * glowA, [90, 255, 200], (0.25 + 0.6 * glowA) * (beam ? 1 : 0.35));
      // the hot cell: lead walls; the fluoride is piped in and comes out as FDG
      const syn = ph === 'synth';
      sc.cyl([TX, TY + 0.27, 0.83], [TX, KY - 0.5, 0.83], 0.035, { rgb: [200, 200, 190], flat: true }, 6);
      if (syn) { const u = clamp((t - run.t1) / 240, 0, 1); if (u < 1) sc.glow([TX, TY + 0.27 + (KY - 0.5 - TY - 0.27) * u, 0.83], 7, [120, 255, 210], 0.95, { px: true, core: true }); }
      sc.box([KX, KY, 0.66], [0.85, 0.5, 0.6], { rgb: [112, 118, 124], amb: 0.55, spec: 0.25 });
      sc.poly([[KX - 0.5, KY - 0.51, 0.62], [KX + 0.5, KY - 0.51, 0.62], [KX + 0.5, KY - 0.51, 1.08], [KX - 0.5, KY - 0.51, 1.08]], { rgb: syn ? [255, 212, 120] : [34, 46, 54], emit: syn ? '255,180,80' : null, emitA: 0.6, out: [0, -1, 0], spec: 0.8 });
      if (syn) sc.glow([KX, KY - 0.6, 0.85], 0.75, [255, 196, 110], 0.42 + 0.18 * Math.sin(tt * 6));
      // the van with its lead pot, driving the medicine to the hospital (the road is drawn shorter than it is)
      const k = ph === 'drive' ? (t - run.t2) / Math.max(1, run.t3 - run.t2) : (ph === 'clinic' || ph === 'done') ? 1 : 0;
      const ek = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      vanX = p.tdMin <= 0 && k > 0 ? 8.6 : -0.6 + 9.2 * ek;
      const VX = vanX, VY = RY - 0.34, lit = ph === 'drive';
      sc.shadow([VX + 0.2, VY, 0.03], 1.3, 0.45, 0.45);
      sc.box([VX, VY, 0.6], [0.78, 0.32, 0.4], { rgb: [238, 240, 242], amb: 0.62, spec: 0.35 });
      sc.box([VX + 0.98, VY, 0.47], [0.22, 0.3, 0.27], { rgb: [222, 226, 230], amb: 0.62 });
      sc.poly([[VX + 1.21, VY - 0.27, 0.45], [VX + 1.21, VY + 0.27, 0.45], [VX + 1.12, VY + 0.25, 0.72], [VX + 1.12, VY - 0.25, 0.72]], { rgb: [40, 62, 84], out: [1, 0, 0.3], spec: 0.9 });
      sc.poly([[VX - 0.78, VY - 0.33, 0.52], [VX + 0.78, VY - 0.33, 0.52], [VX + 0.78, VY - 0.33, 0.66], [VX - 0.78, VY - 0.33, 0.66]], { rgb: [242, 192, 40], out: [0, -1, 0], shade: false });
      // the radiation sign on the side
      sc.custom([VX - 0.1, VY - 0.34, 0.9], (g, x, y, kk) => { const r = Math.max(3, kk * 0.13); g.fillStyle = '#f2c028'; g.beginPath(); g.arc(x, y, r * 1.35, 0, TAU); g.fill(); g.fillStyle = '#1a1a1a'; for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * TAU / 3; g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, a - 0.52, a + 0.52); g.fill(); } g.fillStyle = '#f2c028'; g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.fill(); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(x, y, r * 0.18, 0, TAU); g.fill(); });
      for (const wx of [-0.45, 0.85]) for (const wy of [-0.33, 0.33]) sc.cyl([VX + wx, VY + wy - 0.06, 0.16], [VX + wx, VY + wy + 0.06, 0.16], 0.16, { rgb: [28, 28, 30], flat: true }, 10);
      if (lit) { for (const dy of [-0.18, 0.18]) sc.glow([VX + 1.23, VY + dy, 0.5], 6, [255, 240, 200], 0.95, { px: true }); sc.glow([VX + 2.2, VY, 0.05], 1.1, [255, 230, 170], 0.18); }
      // the hospital, cut open: the PET scanner, its bed and today's patients
      room(sc, HX0, 0.8, [206, 214, 216], [176, 196, 204], HX0 + 3.85);
      sc.pool([SX, SY - 0.6, 0.13], 2.6, 2.2, [255, 214, 170], 0.12);
      sc.shadow([SX, SY, 0.13], 1.1, 0.5, 0.3);
      sc.box([HX0 - 2.6, 3.6, 1.6], [0.08, 0.04, 0.36], { rgb: [214, 52, 52], amb: 0.9, shade: false }); sc.box([HX0 - 2.6, 3.6, 1.6], [0.36, 0.04, 0.08], { rgb: [214, 52, 52], amb: 0.9, shade: false });
      sc.box([SX, SY, 0.34], [0.72, 0.3, 0.3], { rgb: [200, 206, 212], amb: 0.6 });
      sc.tube([SX, SY - 0.32, SZ], [SX, SY + 0.32, SZ], 0.42, 0.95, { rgb: [236, 240, 244], innerRgb: [120, 130, 140], endRgb: [244, 246, 248], amb: 0.62, spec: 0.35 }, 36);
      sc.circle([SX, SY - 0.33, SZ], [0, 1, 0], 0.7, 'rgba(90,170,255,0.85)', 2.2);
      sc.box([SX, SY - 1.55, 0.6], [0.26, 1.2, 0.05], { rgb: [64, 104, 150], amb: 0.6 });
      sc.box([SX, SY - 1.9, 0.3], [0.18, 0.4, 0.27], { rgb: [150, 156, 162], amb: 0.6 });
      const kp = patNow(), inScan = ph === 'clinic' && kp >= 0 && t - run.pats[kp].t < P.slot * 0.85;
      if (inScan || ph === 'clinic') { const y0 = inScan ? SY - 1.1 : SY - 2.5; sc.cyl([SX, y0, 0.82], [SX, y0 + 1.3, 0.82], 0.16, { rgb: [120, 172, 214], amb: 0.62 }, 12); sc.cyl([SX, y0 + 1.3, 0.82], [SX, y0 + 1.55, 0.82], 0.12, { rgb: [222, 186, 160], amb: 0.65 }, 10); }
      // positrons meet electrons: two 511 keV gamma rays fly apart back to back and light up the ring of detectors
      if (inScan && running && !reduceMotion) if (Math.random() < 14 * dtr) flashes.push({ o: [SX + (Math.random() - 0.5) * 0.2, SY - 0.35, SZ - 0.18 + (Math.random() - 0.5) * 0.12], a: Math.random() * Math.PI, age: 0 });
      flashes = flashes.filter(q => (q.age += dtr) < 0.4);
      for (const q of flashes) {
        const d = [Math.cos(q.a), 0, Math.sin(q.a)], al = 1 - q.age / 0.4, e1 = [SX + d[0] * 0.72, q.o[1], SZ + d[2] * 0.72], e2 = [SX - d[0] * 0.72, q.o[1], SZ - d[2] * 0.72];
        sc.line(q.o, e1, `rgba(255,130,255,${al})`, 1.6, { glow: 'rgba(255,120,255,0.8)', layer: 'front' }); sc.line(q.o, e2, `rgba(255,130,255,${al})`, 1.6, { glow: 'rgba(255,120,255,0.8)', layer: 'front' });
        sc.glow(e1, 9, [255, 170, 255], al, { px: true, layer: 'front' }); sc.glow(e2, 9, [255, 170, 255], al, { px: true, layer: 'front' });
      }
      // today's patients: a slot every 20 minutes; dark slots are the ones the medicine ran out for
      const nSlot = Math.floor(P.day / P.slot), done = ph === 'clinic' || ph === 'done' ? patNow() + 1 : 0;
      for (let i = 0; i < nSlot; i++) {
        const col = i % 6, rw = Math.floor(i / 6), x = HX0 + 1.05 + col * 0.42, y = 3.1 - rw * 0.62;
        const has = i < run.pats.length, sc2 = i < done;
        const rgb = sc2 ? [236, 120, 226] : has ? [214, 222, 228] : [64, 70, 74];
        sc.cyl([x, y, 0.12], [x, y, 0.4], 0.1, { rgb, amb: 0.8, spec: 0.15 }, 10);
        sc.sphere([x, y, 0.5], 0.085, sc2 ? [255, 170, 245] : has ? [240, 236, 230] : [78, 82, 86]);
        if (sc2) sc.glow([x, y, 0.45], 0.32, [255, 120, 240], 0.35);
      }
      // labels
      sc.label([CX, CY, 2.7], 'cyclotron', { color: '#e6ece8' });
      sc.label([TX + 0.1, TY - 0.35, 0.3], '¹⁸O water', { color: '#9df5d0', dy: 12 });
      sc.label([KX, KY, 1.75], 'hot cell: FDG', { color: '#ffd590' });
      if (ph === 'drive' || (ph === 'synth' && wide)) sc.label([VX, VY, 1.35], ph === 'synth' ? 'van waiting' : GBq(A), { color: '#ffd590' });
      sc.label([SX, SY, 2.35], 'PET scanner', { color: '#e6ece8' });
      if (wide) sc.label([HX0 + 2.1, 3.1, 1.05], 'today’s patients', { color: '#ffb0ff' });
      if (wide && (ph === 'ready' || ph === 'done')) sc.label([3.0, RY - 1.2, 0.1], p.tdMin > 0 ? `road: ${hm(p.tdMin * 60)} (drawn shorter)` : 'no road: the cyclotron is in the hospital', { color: 'rgba(214,224,218,0.8)' });
      sc.end();
      overlay(c, W, H, A, ph);
    }
    // the big readout, the timeline of the day, the doses
    function overlay(c, W, H, A, ph) {
      const wide = W >= 620, x = 14, y = wide ? 16 : 52;
      c.fillStyle = 'rgba(6,10,12,0.72)'; rrect(c, x - 6, y - 8, wide ? 238 : 170, wide ? 86 : 64, 8); c.fill();
      text(c, 'fluorine-18 in hand', x + 4, y + 6, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
      text(c, GBq(A), x + 4, y + 28, { size: wide ? 28 : 20, color: '#9df5d0' });
      if (wide) text(c, `${mCi(A)} · halves every 110 min`, x + 4, y + 56, { size: 11.5, color: 'rgba(214,224,218,0.7)' });
      // timeline
      const tl = W < 600 ? 12 : 16, tr = W - (W < 600 ? 60 : 70), ty = H - 26, T = endT(), X = s => tl + (tr - tl) * clamp(s / T, 0, 1);
      const segs = [[0, run.t1, '90,220,255', 'beam'], [run.t1, run.t2, '255,190,90', 'FDG'], [run.t2, run.t3, '214,224,218', 'drive'], [run.t3, T, '255,130,255', 'patients']];
      c.fillStyle = 'rgba(6,10,12,0.72)'; rrect(c, tl - 6, ty - 20, tr - tl + 12, 34, 7); c.fill();
      for (const [a, b, rgb, s] of segs) { if (b <= a) continue; c.fillStyle = `rgba(${rgb},0.75)`; c.fillRect(X(a), ty, Math.max(1, X(b) - X(a) - 1), 6); if (X(b) - X(a) > 40) text(c, s, (X(a) + X(b)) / 2, ty - 9, { size: 11, align: 'center', color: `rgba(${rgb},0.95)` }); }
      for (const q of run.pats) { c.fillStyle = t >= q.t ? '#fff' : 'rgba(255,255,255,0.35)'; c.fillRect(X(q.t) - 0.5, ty - 2, 1, 10); }
      if (t > 0) { const mx = X(t); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(mx, ty - 3); c.lineTo(mx - 5, ty - 10); c.lineTo(mx + 5, ty - 10); c.fill(); }
      // doses
      if (ph === 'clinic' || ph === 'done' || (wide && ph === 'drive')) {
        const n = ph === 'drive' ? 0 : patNow() + 1, bx = W < 600 ? x - 6 : W - 260, by = W < 600 ? y + 72 : 16;
        c.fillStyle = 'rgba(6,10,12,0.72)'; rrect(c, bx, by - 8, W < 600 ? 170 : 190, 50, 8); c.fill();
        text(c, `${run.doses} doses’ worth arrived`, bx + 10, by + 6, { size: 11.5, color: 'rgba(214,224,218,0.8)' });
        text(c, `${n} of ${run.pats.length} patients scanned`, bx + 10, by + 26, { size: 13.5, color: '#ffb0ff' });
      }
    }

    /* ---- 2D: the same day as a strip from cyclotron to scanner ---- */
    function draw2d(c, W, H, dtr, running) {
      const ph = phase(), A = run.activity(Math.max(0, t)), tt = performance.now() / 1000, gy = H * 0.66;
      const g = c.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, '#16213a'); g.addColorStop(1, '#6a4a5a'); c.fillStyle = g; c.fillRect(0, 0, W, gy);
      c.fillStyle = '#1b2220'; c.fillRect(0, gy, W, H - gy);
      const u = Math.min(W / 16, H / 6.5), X = s => W * s, beam = ph === 'beam';
      // cyclotron seen from above: the two dees and the spiral
      const cx = X(0.12), cy = gy - u * 1.35, r = u * 0.9;
      c.fillStyle = '#2b4f74'; c.beginPath(); c.arc(cx, cy, r * 1.16, 0, TAU); c.fill();
      for (const s of [-1, 1]) { c.fillStyle = s < 0 ? 'rgba(229,72,63,0.32)' : 'rgba(62,126,230,0.4)'; c.beginPath(); c.arc(cx + s * 2, cy, r, s < 0 ? Math.PI / 2 : -Math.PI / 2, s < 0 ? Math.PI * 1.5 : Math.PI / 2); c.fill(); }
      c.strokeStyle = `rgba(140,230,255,${beam ? 0.95 : 0.3})`; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i <= 200; i++) { const q = i / 200, a = q * 5 * TAU + (beam && !reduceMotion ? tt * 4 : 0), rr = r * (0.06 + 0.9 * Math.sqrt(q)); i ? c.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : c.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); } c.stroke();
      text(c, 'cyclotron', cx, cy + r * 1.16 + 14, { size: 12, align: 'center' });
      text(c, `${pl(energy(), 3)} MeV protons`, cx, cy + r * 1.16 + 30, { size: 11, align: 'center', color: '#9fd8ff' });
      const tx = X(0.25), ty = cy, ga = clamp(A / Math.max(run.Asat, 1), 0, 1);
      c.strokeStyle = beam ? 'rgba(140,230,255,0.95)' : 'rgba(170,176,180,0.5)'; c.lineWidth = beam ? 3 : 2; c.beginPath(); c.moveTo(cx + r * 1.16, cy); c.lineTo(tx - 10, ty); c.stroke();
      if (ph !== 'ready') glow(c, tx, ty, 14 + 30 * ga, '90,255,200', 0.3 + 0.6 * ga * (beam ? 1 : 0.4));
      c.fillStyle = '#9aa4aa'; rrect(c, tx - 10, ty - 12, 20, 24, 4); c.fill();
      text(c, '¹⁸O water', tx, ty + 26, { size: 11, align: 'center', color: '#9df5d0' });
      const hx = X(0.36); c.fillStyle = ph === 'synth' ? '#c9a24a' : '#5c666c'; rrect(c, hx - 22, gy - 52, 44, 52, 5); c.fill(); text(c, 'FDG', hx, gy - 26, { size: 13, align: 'center', color: ph === 'synth' ? '#1b1b1b' : '#e6ece8', halo: ph === 'synth' ? 0 : 3.5 }); text(c, `${Math.round(P.synthT / 60)} min`, hx, gy + 14, { size: 11, align: 'center', color: 'rgba(214,224,218,0.75)' });
      // road and van
      const r0 = X(0.44), r1 = X(0.74);
      c.fillStyle = '#30363a'; c.fillRect(r0, gy - 4, r1 - r0, 10); c.fillStyle = '#e6c85a'; for (let x = r0; x < r1; x += 18) c.fillRect(x, gy, 9, 2);
      const k = ph === 'drive' ? (t - run.t2) / Math.max(1, run.t3 - run.t2) : ph === 'ready' || ph === 'beam' || ph === 'synth' ? 0 : 1, vx = r0 + (r1 - r0 - 46) * k;
      c.fillStyle = '#eceef0'; rrect(c, vx, gy - 26, 46, 22, 4); c.fill(); c.fillStyle = '#f0be28'; c.fillRect(vx, gy - 16, 34, 4); c.fillStyle = '#202022'; c.beginPath(); c.arc(vx + 9, gy - 3, 5, 0, TAU); c.arc(vx + 37, gy - 3, 5, 0, TAU); c.fill();
      text(c, p.tdMin > 0 ? `${hm(p.tdMin * 60)} on the road` : 'no road: same building', (r0 + r1) / 2, gy + 22, { size: 11.5, align: 'center', color: 'rgba(214,224,218,0.8)' });
      // hospital with the scanner ring seen from the front
      const sx = X(0.86), sy = gy - u * 1.3, sr = u * 1.05;
      c.fillStyle = '#d7dce0'; rrect(c, sx - sr * 1.6, gy - sr * 2.9, sr * 3.2, sr * 2.9, 6); c.fill(); c.fillStyle = '#c84040'; c.fillRect(sx - 10, gy - sr * 2.75, 20, 6); c.fillRect(sx - 3, gy - sr * 2.75 - 7, 6, 20);
      c.fillStyle = '#eef1f4'; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill(); c.fillStyle = '#7a8a96'; c.beginPath(); c.arc(sx, sy, sr * 0.45, 0, TAU); c.fill();
      const kp = patNow(), inScan = ph === 'clinic' && kp >= 0 && t - run.pats[kp].t < P.slot * 0.85;
      if (inScan) { c.fillStyle = '#78aad2'; c.beginPath(); c.arc(sx, sy + sr * 0.12, sr * 0.2, 0, TAU); c.fill(); }
      if (inScan && running && !reduceMotion && Math.random() < 20 * dtr) flashes.push({ o: null, a: Math.random() * Math.PI, age: 0 });
      flashes = flashes.filter(q => (q.age += dtr) < 0.35);
      for (const q of flashes) { const al = 1 - q.age / 0.35, dx = Math.cos(q.a) * sr * 0.72, dy = Math.sin(q.a) * sr * 0.72; c.strokeStyle = `rgba(255,120,255,${al})`; c.lineWidth = 1.6; c.beginPath(); c.moveTo(sx - dx, sy - dy); c.lineTo(sx + dx, sy + dy); c.stroke(); glow(c, sx + dx, sy + dy, 7, '255,160,255', al); glow(c, sx - dx, sy - dy, 7, '255,160,255', al); }
      text(c, 'PET scanner', sx, gy + 14, { size: 12, align: 'center' });
      // today's patients: one slot every 20 minutes; dark where the medicine ran out
      { const nS = Math.floor(P.day / P.slot), done = ph === 'clinic' || ph === 'done' ? patNow() + 1 : 0, dw = Math.min(10, (sr * 3.2) / nS), x0 = sx - dw * (nS - 1) / 2;
        for (let i = 0; i < nS; i++) { c.fillStyle = i < done ? '#ff9cf0' : i < run.pats.length ? '#dfe6ea' : '#40464a'; c.beginPath(); c.arc(x0 + i * dw, gy + 32, Math.max(1.6, dw * 0.32), 0, TAU); c.fill(); }
        text(c, W < 600 ? `${run.pats.length} of ${nS} patients` : `today’s patients: ${run.pats.length} of ${nS} slots`, Math.min(sx, W - 52), gy + 48, { size: 11, align: 'center', color: '#ffb0ff' }); }
      overlay(c, W, H, A, ph);
    }

    function sideNotes() {
      const mn = $('#rsPetMNote'); if (mn) mn.innerHTML = p.m === 'yours' ? yoursWhy() : MACH[p.m].note;
      const tn = $('#rsPetTNote'); if (tn) tn.innerHTML = `After ${hm(p.tbMin * 60)} the target holds <b>${pl(100 * (1 - Math.exp(-P.lam * p.tbMin * 60)), 3)} %</b> of the most it can ever hold: fluorine-18 decays while it is being made, so a longer run gives less and less extra.`;
      const dn = $('#rsPetDNote'); if (dn) dn.innerHTML = `On the road the medicine loses <b>${pl(100 * (1 - Math.exp(-P.lam * p.tdMin * 60)), 3)} %</b> of its fluorine-18: half every 110 minutes, so the cyclotron must be close to the hospital.`;
      const en2 = $('#rsPetENote'); if (en2) en2.innerHTML = `Real targets give about half to two thirds of the ideal yield: the protons lose energy in the window foils and not all the fluorine is recovered.`;
    }
    const sim = {
      go: 'Start the day', speeds: [['300', '300× faster'], ['900', '900× faster'], ['3600', 'an hour a second']], speed0: '900',
      canvasLabel: 'A hospital cyclotron makes fluorine-18 in a target of oxygen-18 water, a hot cell turns it into FDG, a van drives it to the hospital and a PET scanner uses it on patients, with the activity shown as it decays',
      graphs: ['Fluorine-18 through the day', 'Patients against the drive to the hospital'],
      side() {
        return `<div class="panel"><div class="panel-title">Which cyclotron?</div><div class="chips chips-cards" id="rs-pet-m">${Object.entries(MACH).map(([k, M]) => `<button type="button" class="chip-btn" data-m="${k}">${M.t}<small>${M.sub}</small></button>`).join('')}</div><p class="hint" id="rsPetMNote"></p></div>
          <details class="acc tag-copper" open><summary><span class="acc-title">The run</span></summary><div class="acc-body">
            ${ctl('pet-i', 'Beam current', 'µA')}
            ${ctl('pet-tb', 'Time in the beam', 'min')}<p class="hint" id="rsPetTNote"></p>
            <div data-level="expert">${ctl('pet-eff', 'Target efficiency', '%')}<p class="hint" id="rsPetENote"></p></div></div></details>
          <details class="acc tag-hazard" open><summary><span class="acc-title">The trip to the hospital</span></summary><div class="acc-body">
            ${ctl('pet-td', 'Driving time', 'min')}<p class="hint" id="rsPetDNote"></p>
            <p class="hint" data-level="beginner">Try 0 (a cyclotron inside the hospital) and then 4 hours. Same machine, same run: count the patients.</p></div></details>`;
      },
      bind(changed) {
        const sync = () => { for (const b of $$('#rs-pet-m button')) b.classList.toggle('is-on', b.dataset.m === p.m); };
        this._sync = sync;
        $('#rs-pet-m').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (!b) return; p.m = b.dataset.m; p.I = MACH[p.m].I; for (const k in ctls) ctls[k].sync(); changed(); });
        ctls.i = range('pet-i', { min: 1, max: 100, step: 1, get: () => p.I, set: v => { p.I = v; changed(); } });
        ctls.tb = range('pet-tb', { min: 5, max: 240, step: 5, get: () => p.tbMin, set: v => { p.tbMin = v; changed(); } });
        ctls.td = range('pet-td', { min: 0, max: 360, step: 5, get: () => p.tdMin, set: v => { p.tdMin = v; changed(); } });
        ctls.eff = range('pet-eff', { min: 30, max: 100, step: 1, get: () => p.eff, set: v => { p.eff = v; changed(); } });
        sync();
      },
      reset() { reset(); sideNotes(); if (this._sync) this._sync(); },
      step,
      draw(c, W, H, dtr, running) { draw2d(c, W, H, dtr, running); },
      home3d: { yaw: -1.38, pitch: 0.3, dist: 30, target: [3.4, 0.6, 0.5], fov: 46, minDist: 2, maxDist: 120, minPitch: 0.05 },
      draw3d(sc, c, W, H, dtr, running) { draw3d(sc, c, W, H, dtr, running); },
      clock: () => t <= 0 ? 'ready' : `${hm(t)} into the day`,
      status() {
        const ph = phase();
        const L = lab();
        if (p.m === 'yours' && (!L || !L.part || L.part.key !== 'proton')) return ['This needs protons: pick the proton in the Cyclotron station', 'is-bad'];
        if (energy() < P.eth) return ['These protons are too slow to make fluorine-18', 'is-bad'];
        if (ph === 'ready') return [`${pl(energy(), 3)} MeV protons, ${pl(p.I, 3)} µA`, ''];
        if (ph === 'beam') return [`Beam on · ${GBq(run.activity(t))} made`, 'is-run'];
        if (ph === 'synth') return ['Turning fluorine into FDG', 'is-run'];
        if (ph === 'drive') return [`On the road · ${GBq(run.activity(t))} left`, 'is-run'];
        if (ph === 'clinic') return [`Patient ${patNow() + 1} of ${run.pats.length}`, 'is-good'];
        return [`${run.pats.length} patients scanned today`, run.pats.length ? 'is-good' : 'is-bad'];
      },
      narrate() {
        const ph = phase(), E = energy(), A = run.activity(Math.max(0, t));
        if (E < P.eth) return p.m === 'yours' ? yoursWhy() : 'Below 2.57 MeV a proton cannot knock a neutron out of oxygen-18, so no fluorine-18 is made.';
        if (simple()) {
          if (ph === 'ready') return `Cancer cells eat a lot of sugar. Hospitals give patients a sugar carrying <b>fluorine-18</b>, which glows in a PET scanner and shows where the cancer is. Fluorine-18 does not exist in nature: a <b>cyclotron</b> makes it, by firing ${pl(E, 3)} MeV protons into water made with oxygen-18. Press <b>Start the day</b>.`;
          if (ph === 'beam') return `The protons spiral out just like in your cyclotron, then hit the water. Now and then a proton knocks a neutron out of an oxygen-18 nucleus and leaves <b>fluorine-18</b>: about 1 in ${pl(1 / Math.max(run.perProton, 1e-12), 2)} protons do it. ${GBq(A)} so far.`;
          if (ph === 'synth') return 'A machine behind lead walls builds the fluorine into a sugar called FDG. This takes about 25 minutes, and the fluorine keeps decaying.';
          if (ph === 'drive') return p.tdMin >= FAR_MIN ? `This van comes from a cyclotron in another city: <b>${hm(p.tdMin * 60)} on the road</b>. Fluorine-18 halves every 110 minutes, so only ${pl(100 * Math.pow(0.5, p.tdMin / 109.77), 2)} % of it will arrive. ${GBq(A)} left.` : `On the road. Fluorine-18 <b>halves every 110 minutes</b>, so every minute in the van costs patients. ${GBq(A)} left.`;
          if (ph === 'clinic') return `Each patient gets 370 MBq. Inside them, each fluorine-18 sends out a positron, which meets an electron: both vanish into <b>two gamma rays</b> flying apart in opposite directions. The ring catches the pair and draws a line to where they came from.`;
          return run.pats.length ? `${run.pats.length} patients scanned with ${run.doses} doses’ worth that arrived. Try a longer drive and see how many fewer.` : 'Not even one dose arrived, so nobody could be scanned. Make more fluorine-18 (a stronger beam or a longer run), or drive less.';
        }
        if (ph === 'ready') return `${pl(E, 3)} MeV protons at ${pl(p.I, 3)} µA (${pl(run.protons / 1e14, 3)} × 10¹⁴ per second) will hit water enriched in oxygen-18. The reaction ¹⁸O(p,n)¹⁸F needs at least 2.57 MeV; its ideal saturation yield at ${pl(E, 3)} MeV is ${pl(R.yIdeal(E) / 1e9, 3)} GBq per µA (Hess et al. 2001), and real targets get about ${p.eff} % of it. Press <b>Start the day</b>.`;
        if (ph === 'beam') return `Beam on. Fluorine-18 builds up as A = A<sub>sat</sub>(1 − e<sup>−λt</sup>): made at a steady rate, but the more there is, the more decays, so it creeps towards A<sub>sat</sub> = ${GBq(run.Asat)}. Now ${GBq(A)} (${pl(100 * A / run.Asat, 3)} %). About one proton in ${pl(1 / Math.max(run.perProton, 1e-12), 2)} makes a nucleus.`;
        if (ph === 'synth') return `End of the beam: ${GBq(run.Aeob)} (${mCi(run.Aeob)}). The hot cell makes FDG in about 25 minutes; about ${pl(P.synthY * 100, 2)} % of the activity comes out as medicine (decay during synthesis included): ${GBq(run.Asyn)}.`;
        if (ph === 'drive') return `On the road for ${hm(p.tdMin * 60)}: A = A₀·e<sup>−λt</sup> with λ = ln 2 / 109.77 min, so ${pl(100 * Math.exp(-P.lam * p.tdMin * 60), 3)} % will arrive: ${GBq(run.Aarr)}, worth ${run.doses} doses of 370 MBq.`;
        if (ph === 'clinic') return `One patient every 20 minutes (one scanner), 370 MBq each, drawn from a vial that keeps decaying. Each ¹⁸F nucleus emits a positron; it annihilates with an electron into two 511 keV photons (E = mc² of each particle) going opposite ways, and the ring of detectors records the pair.`;
        if (!run.pats.length) return `Only ${GBq(run.Aarr)} arrived: less than one 370 MBq dose, so nobody could be scanned. Make more fluorine-18 (a stronger beam, a longer run, faster protons) or drive less.`;
        return `${run.pats.length} patients scanned in ${hm(Math.max(0, endT() - run.t3))}. ${run.doses} doses’ worth had arrived, but the vial kept decaying while patients waited their turn: after the last one ${GBq(run.left)} was left, and 20 minutes later that is ${GBq(run.left * Math.exp(-P.lam * P.slot))}, less than one dose. Try a driving time of 0, or a longer run.`;
      },
      tiles() {
        const E = energy();
        return [
          ['Proton energy', E > 0 ? `${pl(E, 3)} MeV` : '–', p.m === 'yours' ? (E > 0 ? 'from your own cyclotron' : 'your cyclotron is not set to protons') : MACH[p.m].sub],
          ['Fluorine-18 made', GBq(run.Aeob), `${mCi(run.Aeob)} at the end of the beam`],
          ['Reaches the hospital', GBq(run.Aarr), `after FDG making and ${hm(p.tdMin * 60)} of road`],
          ['Patients', `${run.pats.length}`, `370 MBq each · ${run.doses} doses’ worth arrived`],
        ];
      },
      graphA(cv) {
        const T = endT(), pts = []; for (let i = 0; i <= 300; i++) { const s = T * i / 300; pts.push([s / 3600, run.activity(s) / 1e9]); }
        const ymax = Math.max(1, run.Aeob / 1e9) * 1.15;
        const r = plot(cv, { xmin: 0, xmax: T / 3600, ymin: 0, ymax, xlabel: 'time (hours)', ylabel: 'fluorine-18 (GBq)', pad: { r: 16 }, series: [{ pts, color: '#7dffd0', width: 2.2 }] });
        if (!r) return;
        const c = r.ctx;
        for (const [s, lab] of [[run.t1, 'beam off'], [run.t2, 'FDG ready'], [run.t3, 'arrives']]) { const x = Math.round(r.XP(s / 3600)) + 0.5; c.strokeStyle = 'rgba(255,214,140,0.35)'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(x, r.pad.t); c.lineTo(x, r.H - r.pad.b); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,214,140,0.85)'; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(lab, x + 3, r.pad.t + 2); }
        if (t > 0) { const x = r.XP(t / 3600), y = r.YP(run.activity(t) / 1e9); glow(c, x, y, 9, '125,255,208', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); }
      },
      graphB(cv) {
        const pts = [], E = energy();
        for (let m = 0; m <= 360; m += 10) { const q = R.petRun({ E, I: p.I, tb: p.tbMin * 60, eff: p.eff / 100, td: m * 60 }); pts.push([m / 60, q.pats.length]); }
        const r = plot(cv, { xmin: 0, xmax: 6, ymin: 0, ymax: Math.max(5, ...pts.map(q => q[1])) + 2, xlabel: 'drive to the hospital (hours)', ylabel: 'patients scanned', pad: { r: 16 }, series: [{ pts, color: '#ffb0ff', width: 2.2 }] });
        if (!r) return;
        const c = r.ctx, x = r.XP(p.tdMin / 60), y = r.YP(run.pats.length); glow(c, x, y, 9, '255,176,255', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
      },
      numbers() {
        const E = energy(), L = lab();
        let h = sec('The protons');
        if (p.m === 'yours' && L) h += row('Energy from your cyclotron', `${pl(E, 3)} MeV`, 'The energy a proton has when its circle reaches the edge of the dees.', `K = (qBR)²/2m = (1.602 × 10⁻¹⁹ C × ${pl(L.B, 3)} T × ${pl(L.R, 3)} m)² / (2 × 1.673 × 10⁻²⁷ kg)`);
        else h += row('Energy', `${pl(E, 3)} MeV`, `${MACH[p.m].t}: ${MACH[p.m].sub}. Most hospital cyclotrons accelerate H⁻ ions and strip off both electrons in a thin foil at the edge: the charge flips from − to +, so the magnet now bends the protons outwards and out of the machine.`, '');
        h += row('Protons per second', `${pl(run.protons / 1e14, 4)} × 10¹⁴`, 'Current is charge per second, and each proton carries e.', `N = I/e = ${pl(p.I, 3)} × 10⁻⁶ A / 1.602 × 10⁻¹⁹ C`);
        h += sec('Making fluorine-18: ¹⁸O + p → ¹⁸F + n');
        h += row('Threshold', '2.57 MeV', 'The products are heavier than what goes in, so the proton must bring the difference as energy, plus a little more because momentum must be kept.', 'Q = (Δ<sub>¹⁸O</sub> + Δ<sub>p</sub>) − (Δ<sub>¹⁸F</sub> + Δ<sub>n</sub>) = (−0.783 + 7.289) − (0.873 + 8.071) MeV = −2.438 MeV; E<sub>th</sub> = −Q·(m<sub>p</sub> + m<sub>O</sub>)/m<sub>O</sub> = 2.438 × 19/18 = 2.57 MeV');
        h += row('Ideal yield at saturation', `${pl(R.yIdeal(E) / 1e9, 4)} GBq per µA`, 'A thick target stops the protons; every slice of energy on the way down adds its share. Measured by Hess et al. (2001) for 96.7 % ¹⁸O water.', 'Y = (I/e)·n·∫σ(E)/S(E) dE, from the threshold up to the beam energy');
        h += row('Real target', `${pl(run.Asat / 1e9, 4)} GBq at saturation`, `× ${p.eff} % target efficiency (an assumption: real machines get roughly 50–65 %).`, `A<sub>sat</sub> = ${pl(R.yIdeal(E) / 1e9, 3)} GBq/µA × ${p.eff} % × ${pl(p.I, 3)} µA`);
        h += row('One fluorine-18 for every', `${pl(1 / Math.max(run.perProton, 1e-12), 3)} protons`, 'At saturation the target makes as many nuclei each second as decay, A<sub>sat</sub>; divide by the protons per second.', '');
        h += row('At the end of the beam', `${GBq(run.Aeob)} = ${mCi(run.Aeob)}`, '', `A = A<sub>sat</sub>(1 − e<sup>−λt</sup>), λ = ln 2 / 109.77 min, t = ${p.tbMin} min → ${pl(100 * (1 - Math.exp(-P.lam * p.tbMin * 60)), 3)} %`);
        h += sec('From the target to the patient');
        h += row('After making FDG', GBq(run.Asyn), 'A cassette machine takes about 22–25 minutes; about 72 % of the activity comes out as FDG (measured without decay correction, so the decay during synthesis is already in it).', '');
        h += row('After the drive', GBq(run.Aarr), `${hm(p.tdMin * 60)} on the road.`, `A = ${GBq(run.Asyn)} × e<sup>−λ·${p.tdMin} min</sup> = ${GBq(run.Aarr)}`);
        h += row('Doses’ worth on arrival', `${run.doses}`, 'An adult PET scan uses about 259–370 MBq (SNMMI/EANM); 370 MBq is used here.', `${GBq(run.Aarr)} / 370 MBq`);
        h += row('Patients scanned', `${run.pats.length}`, 'One scanner, a patient every 20 minutes for up to 8 hours (assumed); each dose is drawn from a vial that keeps decaying. Each patient rests for about an hour after the injection while the sugar is taken up, then is scanned.', '');
        h += sec('In the scanner');
        h += row('Each decay', 'a positron', '¹⁸F → ¹⁸O + e⁺ + ν in 97 % of decays. The positron slows down and meets an electron within about a millimetre; both are annihilated.', '');
        h += row('Gamma rays', '2 × 511 keV, back to back', 'Each gamma ray carries E = mc² of one electron, 511 keV. The pair was almost at rest, so momentum must stay almost zero: the two fly apart in (almost exactly) opposite directions. Detectors on both sides fire together and the line between them passes through the tumour.', 'E = m<sub>e</sub>c² = 9.109 × 10⁻³¹ kg × (2.998 × 10⁸ m/s)² = 8.19 × 10⁻¹⁴ J = 511 keV');
        return h;
      },
      check() {
        const eta = p.eff / 100, Y = (E, I, tm) => R.yIdeal(E) * eta * I * (1 - Math.exp(-P.lam * tm * 60));
        const cmp = (what, model, real, fmt, realTxt, src) => [what, fmt(model), realTxt, src, Math.abs(model / real - 1) <= 0.2 ? 'good' : 'warn'];
        const rows = [
          cmp('RS Kanker Dharmais: 11 MeV, 30 µA for 20 min', Y(11, 30, 20), 395 * MCI, mCi, '395 mCi (measured)', 'uny'),
          cmp('MRCCC Siloam: 18 MeV, 37 µA for 40 min', Y(18, 37, 40), 1961 * MCI, mCi, '1961 mCi (measured)', 'uny'),
          cmp('DECY-13: 13 MeV, 30 µA for 40 min', Y(13, 30, 40), 1223 * MCI, mCi, '1223 mCi (its designers’ calculation)', 'uny'),
          cmp('GE PETtrace, Michigan: 16 MeV, 55 µA for 22 min', Y(16, 55, 22), 1330 * MCI, mCi, '1330 ± 153 mCi (measured)', 'umich'),
          cmp('IBA water targets at 18 MeV, at saturation', R.yIdeal(18) * eta, 8.5e9, A => `${pl(A / 1e9, 3)} GBq per µA`, '8.3–8.7 GBq per µA (measured)', 'ibat'),
          ['Half-life of fluorine-18', '109.77 min', '109.77 min', 'nndc', 'good'],
          ['FDG out of the hot cell', `${pl(P.synthY * 100, 2)} % in 25 min`, '72 % (not decay-corrected); 22–25 min', 'umich', 'good'],
        ];
        return `<p class="hint">The same model, with ${p.eff} % target efficiency, against four real machines (two of them in Jakarta) and the one Indonesia is building. Green: within 20 %.</p>` + cmpTable(rows)
          + '<p class="hint">Real targets differ in their window foils, how enriched the water is and how much fluorine is recovered, so no single efficiency fits every machine exactly.</p>';
      },
      keyNumbers() {
        const E = energy();
        return row('Proton energy', `${pl(E, 3)} MeV`, 'Enough to knock a neutron out of oxygen-18 (needs 2.57 MeV).')
          + row('Fluorine-18 made', GBq(run.Aeob), `After ${hm(p.tbMin * 60)} in the beam.`)
          + row('Half-life', '110 minutes', 'Every 110 minutes half of it is gone, made or not.')
          + row('Reaches the hospital', GBq(run.Aarr), `${pl(100 * Math.exp(-P.lam * p.tdMin * 60), 3)} % survives the drive.`)
          + row('Patients scanned', `${run.pats.length}`, '370 MBq each, one every 20 minutes.');
      },
      link(sm) {
        const L = lab();
        const rows = [
          ['Particle', L ? `${L.part.name} (${L.part.symbol})` : 'proton', 'protons (from H⁻ ions)'],
          ['Energy at the edge, K = (qBR)²/2m', L ? `${en(L.Kmax)}` : '–', `${pl(energy(), 3)} MeV`],
          ['What it is for', 'learning how the cyclotron works', 'making fluorine-18 for cancer scans'],
        ];
        if (!sm) rows.push(['Beam', L ? 'one particle at a time' : '–', `${pl(p.I, 3)} µA: ${pl(run.protons / 1e14, 3)} × 10¹⁴ protons a second`], ['Why a cyclotron', 'f = qB/2πm does not depend on speed, so one RF frequency keeps pushing', 'the same: a compact machine that fits in a hospital basement']);
        return {
          title: 'How is a hospital cyclotron like yours?',
          text: sm ? `Hospital cyclotrons are your machine at work: the same dees, the same magnet, the same spiral. At 11 to 18 MeV the protons are fast enough to turn oxygen-18 into <b>fluorine-18</b>, which shows doctors where cancer is. And because fluorine-18 halves every 110 minutes, the cyclotron has to be close to the hospital.`
            : `Every hospital cyclotron is a fixed-frequency machine like yours: f = qB/2πm stays the same as the protons speed up (they stay far below the speed of light at 18 MeV), so one RF frequency keeps them in step, and the energy is set by the size of the magnet: K = (qBR)²/2m. Above 2.57 MeV a proton can turn ¹⁸O into ¹⁸F; the yield rises steeply up to about 18 MeV, which is why hospital machines are built for 11–18 MeV.`,
          cols: ['Your cyclotron', 'A hospital cyclotron'], rows, alt: 'Animation: on the left your cyclotron’s spiral, on the right the hospital cyclotron’s beam hitting a target and a PET scanner catching two gamma rays',
          draw: (c, W, H, t2) => twoPanels(c, W, H, t2, panelCyclo('the dees push it: the circle grows'), (c2, w2, h2, t3) => {
            const ex = w2 * 0.3, ey = h2 * 0.56, rr = Math.min(w2, h2) * 0.2;
            c2.strokeStyle = 'rgba(120,220,255,0.8)'; c2.lineWidth = 1.3; c2.beginPath(); for (let i = 0; i <= 120; i++) { const q = i / 120, a = q * 5 * TAU, r = rr * Math.sqrt(q); i ? c2.lineTo(ex + r * Math.cos(a), ey + r * Math.sin(a)) : c2.moveTo(ex + r * Math.cos(a), ey + r * Math.sin(a)); } c2.stroke();
            const sx = w2 * 0.75, ph2 = (t3 % 1.2) / 1.2;
            c2.strokeStyle = 'rgba(140,230,255,0.9)'; c2.lineWidth = 2; c2.beginPath(); c2.moveTo(ex + rr, ey); c2.lineTo(ex + rr + (sx - rr * 1.2 - ex - rr) * Math.min(1, ph2 * 2), ey); c2.stroke();
            c2.strokeStyle = 'rgba(230,234,238,0.8)'; c2.lineWidth = 5; c2.beginPath(); c2.arc(sx, ey, rr * 0.9, 0, TAU); c2.stroke();
            if (ph2 > 0.5) { const a = (Math.floor(t3 / 1.2) * 1.7) % Math.PI, d = rr * 0.9; c2.strokeStyle = 'rgba(255,120,255,0.9)'; c2.lineWidth = 1.5; c2.beginPath(); c2.moveTo(sx - d * Math.cos(a), ey - d * Math.sin(a)); c2.lineTo(sx + d * Math.cos(a), ey + d * Math.sin(a)); c2.stroke(); glow(c2, sx + d * Math.cos(a), ey + d * Math.sin(a), 7, '255,160,255', 0.9); glow(c2, sx - d * Math.cos(a), ey - d * Math.sin(a), 7, '255,160,255', 0.9); }
            text(c2, 'a hospital cyclotron', 10, 15, { size: 13 });
            text(c2, `${pl(energy(), 3)} MeV protons → fluorine-18`, 10, 33, { size: 12, color: '#9df5b8' });
            text(c2, 'the scanner catches two 511 keV gamma rays', 10, h2 - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
          }),
        };
      },
      sources: ['hess', 'exfor', 'nndc', 'ame', 'uny', 'dharm', 'umich', 'ibat', 'fastlab', 'snmmi', 'eanm', 'kemkes'],
      whySources: ['kemkesfw', 'ugm', 'acs'],
      // why it exists: the same cyclotron and the same run, with the cyclotron near the scanner or in another city
      get without() { return p.tdMin >= FAR_MIN; },
      setWithout(b) {
        if (b && p.tdMin < FAR_MIN) { tdNear = p.tdMin; p.tdMin = FAR; }
        else if (!b && p.tdMin >= FAR_MIN) p.tdMin = tdNear < FAR_MIN ? tdNear : 30;
        if (ctls.td) ctls.td.sync();
      },
      why(sm) {
        const E = energy(), near = p.tdMin < FAR_MIN ? p.tdMin : (tdNear < FAR_MIN ? tdNear : 30);
        const run2 = td => R.petRun({ E, I: p.I, tb: p.tbMin * 60, eff: p.eff / 100, td: td * 60 }).pats.length;
        const nFar = run2(FAR), nNear = run2(near), far = p.tdMin >= FAR_MIN;
        const pt = n => `${n} patient${n === 1 ? '' : 's'}`;
        return {
          q: 'Why does a hospital need a cyclotron nearby?',
          a: sm ? 'Cancer is the third biggest cause of death in Indonesia, and many people die because it is found too late. A PET scan finds it and shows where it has spread: cancer cells take up more sugar, so a sugar carrying <b>fluorine-18</b> makes them light up on the scan. But fluorine-18 does not exist in nature and halves every 110 minutes, so a cyclotron has to make it every morning, close to the patients.'
            : 'Cancer killed 242,099 people in Indonesia in 2022, many because it was found late. PET finds tumours and their spread because cancer cells take up more glucose, so FDG labelled with <b>fluorine-18</b> lights them up. Fluorine-18 is made by ¹⁸O(p,n)¹⁸F with 11–18 MeV protons and decays with a 110-minute half-life: the cyclotron has to be close to the scanner.',
          metric: 'Patients scanned in one day, one scanner',
          pick: true,
          rows: [
            { k: 'off', label: `Cyclotron in another city, ${FAR / 60} hours away`, v: nFar, txt: pt(nFar), cur: far },
            { k: 'on', label: near ? `Cyclotron nearby, ${hm(near * 60)} away` : 'Cyclotron in the hospital itself', v: nNear, txt: pt(nNear), cur: !far },
          ],
          verdict: E < P.eth ? 'These protons are too slow to make fluorine-18: no scans at all.' : nNear === 0 ? 'Not enough fluorine-18 for even one patient: make more (a stronger beam or a longer run).' : nNear > nFar ? `Same cyclotron, same run: <b>${nNear - nFar} more patient${nNear - nFar === 1 ? '' : 's'} a day</b> when it is close, because the medicine decays on the road.` : 'Both fill every slot of the day: here the scanner, not the drive, is the limit.',
        };
      },
      helps(sm) {
        const lossH = 100 * (1 - Math.pow(0.5, 60 / 109.77)), n = run.pats.length;
        return [
          ['scan', 'Patients', 'A PET scan shows where cancer is, how far it has spread and whether the treatment is working.', 'acs'],
          ['chart', 'Indonesia', 'Cancer is the third leading cause of death: 408,661 new cases and 242,099 deaths in 2022. Many die because it is found late.', 'kemkesfw'],
          ['clock', 'Hospitals', `Every hour on the road costs ${pl(lossH, 2)} % of the medicine, so cyclotrons are built in or next to hospitals, as in Jakarta.`, 'nndc'],
          ['people', 'This setup', n ? `${n} patients a day from one scanner: about ${(n * 250).toLocaleString('en-US')} scans a year (250 working days).` : 'No patient can be scanned with these settings: make more fluorine-18 or drive less.', ''],
        ];
      },
    };
    return sim;
  }

  /* =====================================================================
     7. PET SCANNER — antimatter in the hospital (in the Collider station)
     A chest slice inside the ring of crystals. Each fluorine-18 nucleus sends out a positron; it meets an electron
     within about a millimetre and both turn into two 511 keV gamma rays that fly apart back to back. The two crystals
     that fire are joined by a line; the picture is made from the lines (back-projection, then a filter), and with time
     of flight every line also says roughly where along it the pair met. Without antimatter (one gamma ray per decay)
     the same ring gets flashes but no lines, and no picture.
     ===================================================================== */
  // the colour scale of PET pictures: black, red, orange, yellow, white
  const HOT = (() => { const L = new Uint8ClampedArray(256 * 3), S = [[0, 0, 0, 0], [0.22, 70, 0, 40], [0.45, 190, 30, 10], [0.68, 255, 130, 20], [0.86, 255, 215, 90], [1, 255, 255, 236]];
    for (let i = 0; i < 256; i++) { const t = i / 255; let k = 0; while (k < S.length - 2 && t > S[k + 1][0]) k++; const [t0, r0, g0, b0] = S[k], [t1, r1, g1, b1] = S[k + 1], f = (t - t0) / (t1 - t0); L[i * 3] = r0 + (r1 - r0) * f; L[i * 3 + 1] = g0 + (g1 - g0) * f; L[i * 3 + 2] = b0 + (b1 - b0) * f; }
    return L; })();

  function makePETScan() {
    const P = R.PETS, ISO = P.ISO;
    const p = { iso: 'f18', d: 3.2, diam: 80, tof: 214, block: false, D: 10, U: 5, pairs: true };
    const ctls = {};
    // the picture: 128 × 128 pixels over ±200 mm, smoothed up to the pixels' highest frequency (R.petImager)
    const IMG = R.petImager({ NG: 128, HW: 200, win: 1 }), NG = IMG.NG, HW = IMG.HW, PX = IMG.PX, rec = IMG.rec, NMAX = 100000;
    let ph, res, seed = 1, N = 0, nDec = 0, nSingles = 0, simT = 0, budget = 0, done = false;
    let lineQ = [], lineN = 0, lineRate = 0, recN = -1, recT = 0, live = [], hist = [], ringHit = new Float32Array(120), lineCv = null, lineG = null, lineKey = '', imgCv = null, imgG = null, imgData = null, vmax = 1, focus = null, v3s = { flashes: [] };
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const Rmm = () => p.diam * 5;
    const iso = () => ISO[p.iso];
    const tofDx = () => (p.tof > 0 ? R.tofDx(p.tof) : 0);
    const tum = () => ph.parts.find(q => q.k === 'tumour');
    function compute() {
      ph = R.petPhantom({ D: p.D, U: p.U }); res = R.petRes({ d: p.d, R: Rmm(), iso: p.iso, block: p.block });
      IMG.setup({ ph, R: Rmm(), d: p.d, iso: p.iso, block: p.block, tof: p.tof });
    }
    function reset() {
      compute(); seed = 1; N = nDec = nSingles = 0; simT = budget = 0; done = false;
      recN = -1; recT = 0; live = []; hist = []; ringHit.fill(0); vmax = 1; focus = null; v3s.flashes = []; lineQ = []; lineN = 0; lineRate = 0;
      if (lineG) lineG.clearRect(0, 0, lineCv.width, lineCv.height);
    }
    // decays a second of scan time: slow at first, so each pair can be watched, then fast enough to build a picture
    const rate = t => (t < 5 ? 1.4 : Math.min(20000, 1.4 * Math.exp((t - 5) * 0.95)));
    // what this picture shows with endless pairs (no noise): the scanner's blur, the pixels and the smoothing (R.petImager)
    const expC = () => IMG.expected().ratio, picF = () => IMG.expected().fwhm;

    function reconstruct() {
      const ratio = IMG.reconstruct(); recN = N;
      if (ratio != null) hist.push([N, ratio]);
      // display scale: a high percentile inside the body, eased so the picture does not flicker
      const vals = []; for (let j = 0; j < NG; j += 2) for (let i = 0; i < NG; i += 2) { const x = -HW + (i + 0.5) * PX, y = HW - (j + 0.5) * PX; if (R.petAt(ph, x, y)) vals.push(rec[j * NG + i]); }
      vals.sort((a, b) => a - b); const top = vals[Math.floor(vals.length * 0.997)] || 1;
      vmax = vmax === 1 ? top : vmax + (top - vmax) * 0.5;
      paintImage();
    }
    function paintImage() {
      if (!imgCv) { imgCv = document.createElement('canvas'); imgCv.width = imgCv.height = NG; imgG = imgCv.getContext('2d'); imgData = imgG.createImageData(NG, NG); }
      const d = imgData.data;
      for (let k = 0; k < NG * NG; k++) { const v = clamp(rec[k] / (vmax || 1), 0, 1), c = Math.round(Math.pow(v, 0.85) * 255) * 3; d[k * 4] = HOT[c]; d[k * 4 + 1] = HOT[c + 1]; d[k * 4 + 2] = HOT[c + 2]; d[k * 4 + 3] = 255; }
      imgG.putImageData(imgData, 0, 0);
    }
    function step(dts, dtr) {
      if (done) return true;
      simT += dts; budget += rate(simT) * dts;
      let k = Math.min(Math.floor(budget), 2400); budget -= k;
      const showAll = rate(simT) < 6, o = { ph, iso: p.iso, R: Rmm(), d: p.d, tof: p.tof, pairs: p.pairs, block: p.block };
      while (k-- > 0) {
        const e = R.petEvent(o, rnd); if (!e) continue; nDec++;
        if (e.single) {
          if (e.esc) { nSingles++; ringHit[Math.floor(((Math.atan2(e.h1.y, e.h1.x) / TAU + 1) % 1) * ringHit.length)]++; }
        } else if (e.esc) { N++; IMG.add(e); lineN++; if (lineQ.length < 90) lineQ.push(e); }
        if (showAll || (live.length < 14 && rnd() < 8 / Math.max(rate(simT), 1))) { live.push({ e, age: 0 }); if (showAll) focus = e; }
      }
      if (p.pairs && N !== recN && (recT += dtr) > (N < 3000 ? 0.25 : 0.5)) { recT = 0; reconstruct(); }
      if ((p.pairs ? N : nSingles) >= NMAX) { done = true; if (p.pairs) reconstruct(); }
      return done;
    }

    /* ---- 2D: the ring around a chest slice, and the picture it makes ---- */
    function layout(W, H) {
      const wide = W >= 640;
      if (wide) {
        const S = Math.min(H - 30, W * 0.5), I = Math.min(H - 84, W - S - 300), mid = W - S - I - 82;
        return { wide, cx: S / 2 + 8, cy: H / 2 + 10, rr: S * 0.41, ix: S + 18 + mid, iy: (H - I) / 2 + 6, I, mx: S + 10 + mid / 2, my: H * 0.5, mr: Math.min(mid * 0.36, H * 0.2, 80) };
      }
      const S = Math.min(W - 8, H - 8); return { wide, cx: W / 2, cy: H / 2 + 10, rr: S * 0.38 };
    }
    // the lines of the last second or so, on their own layer: each fades, so the web shows where pairs come from now
    function drawLineTo(e, alpha) {
      const L = lineCv._L, s = L.rr / Rmm(), dpr = lineCv._dpr, R0 = Rmm();
      lineG.strokeStyle = `rgba(255,120,235,${alpha})`; lineG.lineWidth = 1 * dpr; lineG.beginPath();
      lineG.moveTo((L.cx + R0 * Math.cos(e.c1.a) * s) * dpr, (L.cy - R0 * Math.sin(e.c1.a) * s) * dpr);
      lineG.lineTo((L.cx + R0 * Math.cos(e.c2.a) * s) * dpr, (L.cy - R0 * Math.sin(e.c2.a) * s) * dpr); lineG.stroke();
    }
    function ensureLines(W, H, L) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), key = `${W}x${H}x${dpr}x${Rmm()}`;
      if (lineKey === key) { lineCv._L = L; return; }
      lineKey = key; lineCv = document.createElement('canvas'); lineCv.width = Math.round(W * dpr); lineCv.height = Math.round(H * dpr); lineG = lineCv.getContext('2d'); lineCv._L = L; lineCv._dpr = dpr;
    }
    function updateLines(dtr, running) {
      if (!lineG) return;
      if (running && dtr > 0) {
        lineRate += ((lineN / dtr) - lineRate) * Math.min(1, dtr * 2); lineN = 0;
        lineG.save(); lineG.globalCompositeOperation = 'destination-out'; lineG.fillStyle = `rgba(0,0,0,${clamp(dtr * 1.4, 0, 1)})`; lineG.fillRect(0, 0, lineCv.width, lineCv.height); lineG.restore();
      }
      // a few lines a second stand out on their own; thousands a second become a faint web
      const a = clamp(0.5 * Math.pow(4 / Math.max(4, lineRate), 0.55), 0.03, 0.5);
      for (const e of lineQ) drawLineTo(e, a);
      lineQ.length = 0;
    }
    function bodyPath(c, f, cx, cy, s) { c.beginPath(); c.ellipse(cx + f.x * s, cy - f.y * s, f.a * s, f.b * s, 0, 0, TAU); }
    function drawSlice(c, cx, cy, s, sm, o = {}) {
      bodyPath(c, ph.body, cx, cy, s); c.fillStyle = o.fill || 'rgba(214,170,150,0.16)'; c.fill(); c.strokeStyle = 'rgba(240,210,195,0.55)'; c.lineWidth = 1.2; c.stroke();
      for (const q of ph.parts) {
        if (q.k === 'tumour' && !o.showTumour) continue;
        bodyPath(c, q, cx, cy, s);
        const fill = { lung: 'rgba(10,14,22,0.55)', heart: 'rgba(200,80,90,0.22)', spine: 'rgba(235,232,220,0.5)', tumour: 'rgba(255,190,80,0.0)' }[q.k];
        if (fill && !o.outline) { c.fillStyle = fill; c.fill(); }
        c.strokeStyle = q.k === 'tumour' ? 'rgba(255,214,120,0.9)' : 'rgba(240,220,210,0.28)'; c.lineWidth = q.k === 'tumour' ? 1.4 : 1; if (q.k === 'tumour') c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
      }
      if (sm && o.labels) {
        const L2 = (t2, x, y, col) => text(c, t2, cx + x * s, cy - y * s, { size: 11, align: 'center', color: col || 'rgba(235,225,215,0.8)' });
        L2('lung', -76, 40); L2('lung', 92, 50); L2('heart', 30, -10, 'rgba(255,190,190,0.85)'); L2('spine', 0, -103);
      }
    }
    function drawRing(c, L, sm, dtr, running) {
      const { cx, cy, rr } = L, R0 = Rmm(), s = rr / R0, tt = performance.now() / 1000;
      // the gantry: a white housing, the bore, and 38 blocks of crystals all round (as in a Biograph Vision)
      c.fillStyle = '#d9dee2'; c.beginPath(); c.arc(cx, cy, rr * 1.2, 0, TAU); c.arc(cx, cy, rr * 1.035, 0, TAU, true); c.fill();
      const gg = c.createRadialGradient(cx, cy, rr * 1.03, cx, cy, rr * 1.2); gg.addColorStop(0, 'rgba(0,0,0,0.25)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gg; c.beginPath(); c.arc(cx, cy, rr * 1.2, 0, TAU); c.arc(cx, cy, rr * 1.035, 0, TAU, true); c.fill();
      c.fillStyle = '#05080a'; c.beginPath(); c.arc(cx, cy, rr * 1.035, 0, TAU); c.fill();
      const nb = 38;
      for (let k = 0; k < nb; k++) {
        const a0 = TAU * k / nb + 0.012, a1 = TAU * (k + 1) / nb - 0.012;
        c.fillStyle = '#2a3238'; c.beginPath(); c.arc(cx, cy, rr * 1.03, -a1, -a0); c.arc(cx, cy, rr * 1.0, -a0, -a1, true); c.closePath(); c.fill();
      }
      c.strokeStyle = 'rgba(150,200,230,0.22)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, rr * 1.015, 0, TAU); c.stroke();
      // the patient: a chest slice
      drawSlice(c, cx, cy, s, sm, { labels: true, showTumour: done || N > 20000 });
      if (lineCv && p.pairs) c.drawImage(lineCv, 0, 0, lineCv.width / lineCv._dpr, lineCv.height / lineCv._dpr);
      // narrow screens: the picture builds up inside the body, as on a fused PET/CT
      if (!L.wide && p.pairs && imgCv && recN > 0) {
        const size = 2 * HW * s; c.save(); bodyPath(c, ph.body, cx, cy, s); c.clip(); c.globalAlpha = clamp(N / 4000, 0.15, 0.95); c.imageSmoothingEnabled = true; c.drawImage(imgCv, cx - size / 2, cy - size / 2, size, size); c.restore();
      }
      // in the singles world: where the flashes landed round the ring (nearly even: no direction)
      if (!p.pairs) {
        const mx = Math.max(1, ...ringHit);
        // inside the bore, next to the crystals that were hit
        for (let k = 0; k < ringHit.length; k++) { const a = TAU * (k + 0.5) / ringHit.length, h = rr * 0.11 * ringHit[k] / mx; c.strokeStyle = 'rgba(255,150,240,0.6)'; c.lineWidth = Math.max(1.5, rr * TAU / ringHit.length * 0.55); c.beginPath(); c.moveTo(cx + Math.cos(a) * rr * 0.975, cy - Math.sin(a) * rr * 0.975); c.lineTo(cx + Math.cos(a) * (rr * 0.975 - h), cy - Math.sin(a) * (rr * 0.975 - h)); c.stroke(); }
        if (nSingles > 300) text(c, 'flashes per crystal: almost even', cx, cy + rr * 0.6, { size: 11.5, align: 'center', color: 'rgba(255,190,245,0.85)' });
      }
      // the pairs being watched
      const P2 = (x, y) => [cx + x * s, cy - y * s];
      for (const q of live) {
        if (running) q.age += dtr;
        const e = q.e, a = q.age, x0 = e.single ? e.x0 : e.ax, y0 = e.single ? e.y0 : e.ay, [px, py] = P2(x0, y0);
        if (a < 0.3) { glow(c, px, py, 6, '120,230,255', 0.9); continue; }
        const f = clamp((a - 0.3) / 0.45, 0, 1);
        if (a < 0.5) glow(c, px, py, 16 * (1 - (a - 0.3) / 0.2) + 4, '255,255,255', 0.9);
        const arms = e.single ? [[e.h1, true]] : [[e.h1, true], [e.h2, true]];
        for (let i = 0; i < arms.length; i++) {
          const h = arms[i][0], fade = a > 0.75 ? clamp(1 - (a - 0.75) / 1.1, 0, 1) : 1;
          // a photon absorbed in the body stops part of the way out (chosen for the drawing; the model only says lost or not)
          const stop = !e.esc && i === arms.length - 1 ? 0.35 + 0.3 * hash(nDec + i) : 1, ff = Math.min(f, stop);
          const ex = x0 + (h.x - x0) * ff, ey = y0 + (h.y - y0) * ff, [qx, qy] = P2(ex, ey);
          c.strokeStyle = `rgba(255,120,240,${0.85 * fade})`; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px, py); c.lineTo(qx, qy); c.stroke();
          if (f >= stop && stop < 1) { c.strokeStyle = `rgba(255,255,255,${0.8 * fade})`; c.lineWidth = 1.4; c.beginPath(); c.moveTo(qx - 4, qy - 4); c.lineTo(qx + 4, qy + 4); c.moveTo(qx + 4, qy - 4); c.lineTo(qx - 4, qy + 4); c.stroke(); }
          else if (f < 1) glow(c, qx, qy, 6, '255,150,240', 0.95);
          else glow(c, qx, qy, 10 * fade + 2, '255,170,250', fade);
        }
        // time of flight: the short stretch of the line where the clocks put the pair
        if (!e.single && e.esc && p.tof > 0 && a > 0.75) {
          const fade = clamp(1 - (a - 0.75) / 1.1, 0, 1), R0b = Rmm(), x1 = R0b * Math.cos(e.c1.a), y1 = R0b * Math.sin(e.c1.a), x2 = R0b * Math.cos(e.c2.a), y2 = R0b * Math.sin(e.c2.a), Ll = Math.hypot(x2 - x1, y2 - y1);
          const ux = (x2 - x1) / Ll, uy = (y2 - y1) / Ll, sm2 = Ll / 2 + (R.C.c * 1e3 * e.dt) / 2, half = tofDx() / 2;
          const [ax, ay] = P2(x1 + ux * (sm2 - half), y1 + uy * (sm2 - half)), [bx, by] = P2(x1 + ux * (sm2 + half), y1 + uy * (sm2 + half));
          c.strokeStyle = `rgba(255,236,160,${fade})`; c.lineWidth = 3.4; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
        }
      }
      live = live.filter(q => q.age < 1.9);
      // the magnifier: one positron's short trip, 40 times bigger
      if (focus && !focus.single && (L.wide || sm)) {
        const mr = L.wide ? L.mr : Math.max(34, rr * 0.27), mx = L.wide ? L.mx : cx - rr * 0.78, my = L.wide ? L.my : cy + rr * 0.78, z = Math.min(mr * 0.55 / Math.max(focus.pr, 0.15), 160);
        c.save(); c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fillStyle = 'rgba(8,12,16,0.92)'; c.fill(); c.clip();
        const ox = mx - (focus.ax - focus.x0) * z / 2, oy = my + (focus.ay - focus.y0) * z / 2, ex = ox + (focus.ax - focus.x0) * z, ey = oy - (focus.ay - focus.y0) * z;
        c.strokeStyle = 'rgba(120,230,255,0.9)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ox, oy);
        for (let i = 1; i <= 8; i++) { const u = i / 8, jx = i < 8 ? (hash(i + seed % 97) - 0.5) * 6 : 0, jy = i < 8 ? (hash(i + 31 + seed % 89) - 0.5) * 6 : 0; c.lineTo(ox + (ex - ox) * u + jx, oy + (ey - oy) * u + jy); }
        c.stroke(); glow(c, ox, oy, 5, '120,230,255', 1); glow(c, ex, ey, 10, '255,255,255', 0.95);
        const dx = Math.cos(focus.th), dy = -Math.sin(focus.th);
        c.strokeStyle = 'rgba(255,120,240,0.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(ex - dx * mr, ey - dy * mr); c.lineTo(ex + dx * mr, ey + dy * mr); c.stroke();
        c.restore();
        c.strokeStyle = 'rgba(214,224,218,0.5)'; c.lineWidth = 1.2; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.stroke();
        text(c, L.wide ? (sm ? 'one pair, magnified' : `one pair, ×${Math.round(z / s)}`) : `×${Math.round(z / s)}`, mx, my - mr - 10, { size: 12, align: 'center', color: '#cfe8ff' });
        text(c, `positron travelled ${pl(focus.pr, 2)} mm`, mx, my + mr + 12, { size: 11.5, align: 'center', color: '#9fe6ff' });
        if (L.wide) { text(c, sm ? 'two gamma rays, 511 keV each,' : `e⁺ + e⁻ → 2γ, 511 keV each`, mx, my + mr + 30, { size: 11.5, align: 'center', color: '#ffb0f4' }); text(c, sm ? 'flying apart back to back' : `${pl(180 + focus.dev * 180 / Math.PI, 4)}° apart`, mx, my + mr + 46, { size: 11.5, align: 'center', color: '#ffb0f4' }); }
      }
      text(c, sm ? 'ring of detectors' : `${Math.round(TAU * Rmm() / p.d)} crystals, ${p.d} mm wide`, cx, cy - rr * 1.2 - 10, { size: 12, align: 'center', color: 'rgba(214,224,218,0.85)' });
    }
    function drawImagePanel(c, L, sm) {
      const { ix, iy, I } = L;
      text(c, sm ? 'What the doctor sees' : p.tof ? 'The picture (time of flight)' : 'The picture (filtered back-projection)', ix, iy - 14, { size: 13, color: '#e6ece8' });
      c.fillStyle = '#000'; c.fillRect(ix, iy, I, I);
      if (!p.pairs) {
        c.fillStyle = 'rgba(120,120,120,0.22)'; c.fillRect(ix, iy, I, I);
        text(c, 'no lines, no picture', ix + I / 2, iy + I / 2 - 10, { size: 15, align: 'center', color: '#ffd590' });
        text(c, 'one gamma ray cannot say where it came from', ix + I / 2, iy + I / 2 + 12, { size: 11.5, align: 'center', color: 'rgba(214,224,218,0.8)' });
      } else if (imgCv && recN > 0) {
        c.save(); c.imageSmoothingEnabled = true; c.drawImage(imgCv, ix, iy, I, I); c.restore();
      } else text(c, 'press Start the scan', ix + I / 2, iy + I / 2, { size: 13, align: 'center', color: 'rgba(214,224,218,0.6)' });
      // the body outline over the picture, as on a PET/CT screen
      const s = I / (2 * HW), cx = ix + I / 2, cy = iy + I / 2;
      c.save(); c.beginPath(); c.rect(ix, iy, I, I); c.clip(); bodyPath(c, ph.body, cx, cy, s); c.strokeStyle = 'rgba(150,200,255,0.35)'; c.lineWidth = 1; c.stroke();
      if (done || N > 20000) { const T = tum(); c.strokeStyle = 'rgba(160,230,255,0.85)'; c.setLineDash([3, 3]); c.beginPath(); c.arc(cx + T.x * s, cy - T.y * s, Math.max(T.a * s + 4, 6), 0, TAU); c.stroke(); c.setLineDash([]); text(c, `${p.D} mm cancer`, cx + T.x * s, cy - T.y * s - Math.max(T.a * s + 4, 6) - 9, { size: 11, align: 'center', color: '#bfeaff' }); }
      c.restore();
      c.strokeStyle = 'rgba(214,224,218,0.3)'; c.lineWidth = 1; c.strokeRect(ix + 0.5, iy + 0.5, I - 1, I - 1);
      const last = hist.length ? hist[hist.length - 1][1] : null;
      text(c, p.pairs ? `${N.toLocaleString('en-US')} pair${N === 1 ? '' : 's'}${last && N > 400 ? ` · the cancer shows ${pl(Math.max(last, 0), 2)}× the tissue around it` : ''}` : `${nSingles.toLocaleString('en-US')} single flashes`, ix, iy + I + 16, { size: 12, color: p.pairs ? '#ffb0f4' : '#ffd590' });
    }
    function draw2d(c, W, H, dtr, running) {
      const L = layout(W, H), sm = simple();
      const g = c.createRadialGradient(L.cx, L.cy, L.rr * 0.2, L.cx, L.cy, Math.max(W, H)); g.addColorStop(0, '#10161a'); g.addColorStop(1, '#05080a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      ensureLines(W, H, L); updateLines(dtr, running);
      drawRing(c, L, sm, dtr, running);
      if (L.wide) drawImagePanel(c, L, sm);
      else text(c, p.pairs ? `${N.toLocaleString('en-US')} pairs` : `${nSingles.toLocaleString('en-US')} flashes, no lines`, 12, H - 12, { size: 12, color: p.pairs ? '#ffb0f4' : '#ffd590' });
    }

    /* ---- 3D: the scanner in its room, the patient on the bed, the pairs flying out to the ring ---- */
    const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    function ellCyl(sc, cx, cz, a, b, y0, y1, st, n) {            // a cylinder with an elliptical cross-section, along y
      for (let k = 0; k < n; k++) {
        const t0 = TAU * k / n, t1 = TAU * (k + 1) / n, p0 = [cx + a * Math.cos(t0), cz + b * Math.sin(t0)], p1 = [cx + a * Math.cos(t1), cz + b * Math.sin(t1)];
        const nx = (Math.cos(t0) / a + Math.cos(t1) / a), nz = (Math.sin(t0) / b + Math.sin(t1) / b), l = Math.hypot(nx, nz) || 1;
        sc.poly([[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]], { ...st, out: [nx / l, 0, nz / l], cull: true, sn: [nrm([Math.cos(t0) / a, 0, Math.sin(t0) / b]), nrm([Math.cos(t1) / a, 0, Math.sin(t1) / b])] });
      }
      for (const [yy, o] of [[y0, -1], [y1, 1]]) sc.poly(Array.from({ length: n }, (_, k) => [cx + a * Math.cos(TAU * k / n), yy, cz + b * Math.sin(TAU * k / n)]), { ...st, out: [0, o, 0], cull: true });
    }
    function draw3d(sc, c, W, H, dtr, running) {
      const R0 = Rmm() / 1000, ZC = 1.0, tt = performance.now() / 1000;
      sc.begin(c, W, H, { bg: [20, 24, 28], fogNear: 1.4, fogFar: 4.5, fogMax: 0.45 });
      sc.floor(0, -4, 4, -4.5, 3, { rgb: [196, 202, 206], light: [255, 255, 255], lightA: 0.08, step: 0.5, gridColor: 'rgba(90,100,110,0.12)' });
      sc.box([0, 2.9, 1.4], [4, 0.06, 1.4], { rgb: [170, 186, 196], amb: 0.6 });
      sc.box([-3.95, -0.8, 1.4], [0.06, 3.7, 1.4], { rgb: [156, 170, 180], amb: 0.6 });
      // the gantry, drawn see-through so the ring of crystals shows; the bore is 78 cm across
      sc.tube([0, -0.42, ZC], [0, 0.42, ZC], 0.39, R0 + 0.55, { rgb: [236, 240, 244], innerRgb: [214, 220, 226], endRgb: [244, 246, 248], a: 0.3, amb: 0.7, spec: 0.3 }, 48);
      sc.box([0, 0, 0.12], [0.75, 0.42, 0.12], { rgb: [220, 224, 228], amb: 0.6 });
      for (let k = 0; k < 38; k++) { const a = TAU * (k + 0.5) / 38, ca = Math.cos(a), sa = Math.sin(a); sc.box([ca * (R0 + 0.02), 0, ZC + sa * (R0 + 0.02)], [0.028, 0.06, 0.02], { rgb: [52, 62, 70], amb: 0.6, spec: 0.4 }, [[ca, 0, sa], [0, 1, 0], [-sa, 0, ca]]); }
      sc.circle([0, 0, ZC], [0, 1, 0], R0, 'rgba(120,200,255,0.35)', 1.2);
      // the bed and the patient, chest in the ring
      sc.box([0, -1.3, ZC - 0.13], [0.24, 1.6, 0.025], { rgb: [70, 90, 110], amb: 0.6 });
      sc.box([0, -1.9, (ZC - 0.155) / 2], [0.2, 0.5, (ZC - 0.155) / 2], { rgb: [180, 186, 192], amb: 0.6 });
      ellCyl(sc, 0, ZC, 0.17, 0.105, -1.7, 0.3, { rgb: [118, 148, 188], amb: 0.62, spec: 0.15 }, 22);
      sc.sphere([0, 0.47, ZC], 0.1, [222, 186, 160]);
      // the pairs: from where they meet to two crystals on the ring (the slice is the plane y = 0)
      for (const q of live) {
        if (running) q.age += dtr;
        const e = q.e, a = q.age, P0 = [(e.single ? e.x0 : e.ax) / 1000, -0.001, ZC + (e.single ? e.y0 : e.ay) / 1000];
        if (a < 0.3) { sc.glow(P0, 6, [120, 230, 255], 0.9, { px: true, layer: 'front' }); continue; }
        if (a < 0.5) sc.glow(P0, 0.06, [255, 255, 255], 0.9, { layer: 'front' });
        const f = clamp((a - 0.3) / 0.45, 0, 1), fade = a > 0.75 ? clamp(1 - (a - 0.75) / 1.1, 0, 1) : 1;
        const arms = e.single ? [e.c1] : [e.c1, e.c2];
        arms.forEach((cc, i) => {
          const stop = !e.esc && i === arms.length - 1 ? 0.5 : 1, ff = Math.min(f, stop), E1 = [Math.cos(cc.a) * R0, 0, ZC + Math.sin(cc.a) * R0], Q = [P0[0] + (E1[0] - P0[0]) * ff, 0, P0[2] + (E1[2] - P0[2]) * ff];
          sc.line(P0, Q, `rgba(255,120,240,${0.9 * fade})`, 1.8, { glow: 'rgba(255,120,240,0.8)', layer: 'front' });
          if (f >= 1 && stop === 1) sc.glow(E1, 9, [255, 170, 250], fade, { px: true, layer: 'front' });
        });
      }
      live = live.filter(q => q.age < 1.9);
      // the monitor with the picture
      sc.box([1.9, -1.2, 0.55], [0.05, 0.05, 0.55], { rgb: [60, 64, 68], amb: 0.6 });
      sc.box([1.9, -1.2, 1.35], [0.04, 0.42, 0.3], { rgb: [24, 26, 28], amb: 0.6 });
      sc.custom([1.86, -1.2, 1.35], (g, x, y, k) => { const w = 0.74 * k, h = 0.52 * k; g.fillStyle = '#000'; g.fillRect(x - w / 2, y - h / 2, w, h); if (p.pairs && imgCv && recN > 0) { const s2 = Math.min(w, h) * 0.96; g.imageSmoothingEnabled = true; g.drawImage(imgCv, x - s2 / 2, y - s2 / 2, s2, s2); } else if (!p.pairs) { g.fillStyle = 'rgba(255,213,144,0.9)'; g.font = `600 ${Math.max(9, k * 0.05)}px "Barlow Condensed", sans-serif`; g.textAlign = 'center'; g.fillText('no picture', x, y); } });
      sc.label([0, 0, ZC + R0 + 0.72], 'PET scanner', { color: '#e6ece8' });
      sc.label([R0 * Math.cos(0.4) + 0.1, 0, ZC + R0 * Math.sin(0.4) + 0.12], `${Math.round(TAU * Rmm() / p.d)} crystals`, { color: '#9fd8ff' });
      sc.label([1.9, -1.2, 1.78], p.pairs ? `${N.toLocaleString('en-US')} pairs` : `${nSingles.toLocaleString('en-US')} flashes`, { color: p.pairs ? '#ffb0f4' : '#ffd590' });
      sc.end();
    }

    const fmtN = n => n.toLocaleString('en-US');
    const ratioNow = () => (hist.length ? hist[hist.length - 1][1] : null);
    function phase() { if (done) return 'done'; if (!(p.pairs ? N : nSingles) && !nDec) return 'ready'; return (p.pairs ? N : nSingles) < 12 ? 'watch' : (p.pairs ? N : nSingles) < 6000 ? 'build' : 'clear'; }
    const TOFS = [['0', 'Off'], ['600', '600 ps'], ['400', '400 ps'], ['214', '214 ps'], ['100', '100 ps']];
    const sim = {
      go: 'Start the scan', speeds: [['1', 'normal'], ['4', '4× faster'], ['16', '16× faster']], speed0: '1',
      canvasLabel: 'A ring of crystals around a slice of a patient’s chest. Positrons from the tracer meet electrons; each pair of gamma rays flies apart back to back, two crystals fire and a line is drawn between them. The picture of where the tracer is builds up from the lines',
      graphs: ['How clearly the cancer shows, as pairs come in', 'How sharp the scanner can be'],
      side() {
        return `<div class="panel"><div class="panel-title">Tracer</div><div class="chips chips-cards" id="rs-ps-iso">${Object.values(ISO).map(I => `<button type="button" class="chip-btn" data-iso="${I.key}">${I.name}<small>${I.sym} · ${I.emax} MeV</small></button>`).join('')}</div><p class="hint" id="rsPsIsoNote"></p></div>
          <details class="acc tag-copper" open><summary><span class="acc-title">The cancer</span></summary><div class="acc-body">
            ${ctl('ps-D', 'Size', 'mm')}<p class="hint" id="rsPsDNote"></p>
            <div data-level="expert">${ctl('ps-U', 'Sugar it takes up', '× tissue')}</div></div></details>
          <details class="acc tag-hazard" open><summary><span class="acc-title">The scanner</span></summary><div class="acc-body">
            <div class="ctl"><div class="ctl-row"><span class="ctl-label">Time of flight</span></div>${segHTML('ps-tof', 'Time of flight', TOFS.map(([v, t]) => [v, t]))}</div><p class="hint" id="rsPsTofNote"></p>
            <div data-level="expert">${ctl('ps-d', 'Crystal width', 'mm')}${ctl('ps-diam', 'Ring diameter', 'cm')}
            <div class="ctl"><div class="ctl-row"><span class="ctl-label">Detectors</span></div>${segHTML('ps-blk', 'Detectors', [['one', 'One crystal per sensor', 'digital'], ['block', 'Shared light', 'older blocks']])}</div></div>
            <p class="hint" data-level="beginner">Try time of flight off and on, and a 4 mm cancer: watch how fast the picture comes.</p></div></details>`;
      },
      bind(changed) {
        const sync = () => { for (const b of $$('#rs-ps-iso button')) b.classList.toggle('is-on', b.dataset.iso === p.iso); };
        this._sync = sync;
        $('#rs-ps-iso').addEventListener('click', ev => { const b = ev.target.closest('[data-iso]'); if (!b) return; p.iso = b.dataset.iso; sync(); changed(); });
        ctls.D = range('ps-D', { min: 3, max: 30, step: 1, int: true, get: () => p.D, set: v => { p.D = v; changed(); } });
        ctls.U = range('ps-U', { min: 1.5, max: 10, step: 0.5, get: () => p.U, set: v => { p.U = v; changed(); } });
        ctls.d = range('ps-d', { min: 2, max: 8, step: 0.1, get: () => p.d, set: v => { p.d = v; changed(); } });
        ctls.diam = range('ps-diam', { min: 60, max: 100, step: 1, int: true, get: () => p.diam, set: v => { p.diam = v; changed(); } });
        ctls.tof = segInit($('#rs-ps-tof'), () => String(p.tof), v => { p.tof = +v; changed(); });
        ctls.blk = segInit($('#rs-ps-blk'), () => (p.block ? 'block' : 'one'), v => { p.block = v === 'block'; changed(); });
        sync();
      },
      reset() {
        reset(); if (this._sync) this._sync();
        const I = iso(), n1 = $('#rsPsIsoNote'); if (n1) n1.innerHTML = `${I.use}. Positrons up to ${I.emax} MeV travel on average <b>${I.range} mm</b> in water before they meet an electron; half-life ${I.half >= 3600 ? pl(I.half / 3600, 3) + ' h' : I.half >= 60 ? pl(I.half / 60, 3) + ' min' : I.half + ' s'}.`;
        const n2 = $('#rsPsDNote'); if (n2) n2.innerHTML = `In this picture a ${p.D} mm cancer should show <b>${pl(expC(), 2)}×</b> as bright as the tissue around it, although it takes up ${pl(p.U, 2)}× the sugar: the picture’s ${pl(picF(), 2)} mm blur smears part of a small spot’s light into its surroundings. Bigger cancers keep more of their brightness.`;
        const n3 = $('#rsPsTofNote'); if (n3) n3.innerHTML = p.tof ? `The two crystals’ clocks differ by Δt; the pair met Δx = cΔt/2 from the middle of the line, give or take <b>${pl(tofDx() / 10, 2)} cm</b> (${p.tof} ps). The Biograph Vision measures 210–215 ps.` : 'Without time of flight each pair only says “somewhere on this line”.';
      },
      step,
      draw(c, W, H, dtr, running) { draw2d(c, W, H, dtr, running); },
      home3d: { yaw: -2.35, pitch: 0.28, dist: 4.4, target: [0.2, -0.3, 0.9], fov: 46, minDist: 0.8, maxDist: 14, minPitch: 0.02 },
      draw3d,
      clock: () => (p.pairs ? `${fmtN(N)} pair${N === 1 ? '' : 's'}` : `${fmtN(nSingles)} flash${nSingles === 1 ? '' : 'es'}`) + (nDec ? ` of ${fmtN(nDec)} decay${nDec === 1 ? '' : 's'}` : ''),
      speedApplies: () => true,
      status() {
        const ph2 = phase();
        if (ph2 === 'ready') return [p.pairs ? `${iso().name}: a ${p.D} mm cancer, ${pl(p.U, 2)}× the sugar` : 'One gamma ray per decay: no antimatter', ''];
        if (!p.pairs) return [ph2 === 'done' ? `${fmtN(nSingles)} flashes and still no picture` : `${fmtN(nSingles)} single flashes · no lines`, ph2 === 'done' ? 'is-bad' : 'is-run'];
        if (ph2 === 'done') { const r = ratioNow(); return [`Scan done · the cancer shows ${pl(r || 0, 2)}× its surroundings`, 'is-good']; }
        return [ph2 === 'watch' ? 'Watch each pair' : `Recording · ${fmtN(N)} pairs`, 'is-run'];
      },
      narrate() {
        const ph2 = phase(), sm = simple(), I = iso(), r = ratioNow();
        if (!p.pairs) {
          if (sm) return ph2 === 'ready' ? 'Now each decay gives <b>one gamma ray</b> instead of an antimatter pair. Press <b>Start the scan</b> and watch the ring.' : `Each flash only says that something, somewhere, decayed. The flashes land evenly all round the ring, so there is no line to draw and <b>no picture</b>, however long you wait. That is why PET uses antimatter.`;
          return ph2 === 'ready' ? 'Same ring, same patient, but one photon per decay: a hit on one crystal carries no direction. (Gamma cameras solve this with a lead grid that only lets straight-in photons through; PET needs no grid because the pair gives the line.)' : `${fmtN(nSingles)} single hits. Their distribution round the ring is almost flat: a hit at angle θ can come from any point of the body on the near side, so back-projection has nothing to work with. A second, back-to-back photon is what turns a hit into a line.`;
        }
        if (sm) {
          if (ph2 === 'ready') return `Cancer cells eat more sugar than the tissue around them. The patient was given sugar carrying <b>${I.name}</b>. Each ${I.name} nucleus shoots out a <b>positron</b>, a particle of antimatter. Press <b>Start the scan</b> and watch.`;
          if (ph2 === 'watch') return `The positron travels about ${I.range} mm (see the magnifier), meets an ordinary electron and <b>both vanish</b>: their mass becomes two flashes of gamma light, 511 keV each. They fly apart in exactly opposite directions, so the line between the two crystals that fire passes through the spot.${p.tof ? ' The yellow mark: the crystals’ clocks tell roughly where on the line it was.' : ''}`;
          if (ph2 === 'build') return `Every line passes through a place where the sugar went. Where many lines cross, the picture gets bright: the heart (it uses a lot of sugar) and, slowly, the cancer. ${fmtN(N)} pairs so far.`;
          if (ph2 === 'clear') return `${fmtN(N)} pairs. The cancer now stands out${r ? `, ${pl(r, 2)}× as bright as the tissue around it` : ''}. It really eats ${pl(p.U, 2)}× the sugar, but at ${p.D} mm it is small next to the picture’s blur, which smears some of its light into its surroundings. Many lines were lost: the body absorbs most gamma rays before they get out.`;
          return `Scan done: the ${p.D} mm cancer shows ${pl(r || 0, 2)}× as bright as its surroundings. Try a bigger or smaller one, or time of flight off.`;
        }
        if (ph2 === 'ready') return `${I.sym}: β⁺ in ${pl(I.beta * 100, 3)} % of decays, positrons up to ${I.emax} MeV, mean range ${I.range} mm in water. The ring has ${Math.round(TAU * Rmm() / p.d)} crystals of ${p.d} mm on a ${p.diam} cm circle and can resolve ${pl(res.fwhm, 3)} mm (FWHM). This picture stops at ${fmtN(NMAX)} pairs, so its ${pl(PX, 3)} mm pixels are smoothed and it blurs ${pl(picF(), 3)} mm: a ${p.D} mm lesion at ${pl(p.U, 2)}:1 should reconstruct at about ${pl(expC(), 3)}:1 (the partial-volume effect).`;
        if (ph2 === 'watch') return `e⁺ + e⁻ → 2γ. The pair is almost at rest, so total momentum ≈ 0 and the photons leave back to back (180° ± 0.25°), each with E = m<sub>e</sub>c² = 511 keV. Two crystals firing together define a line of response.${p.tof ? ` Time of flight: Δx = cΔt/2, here ±${pl(tofDx() / 20, 2)} cm.` : ''}`;
        if (ph2 === 'build') return `${fmtN(N)} lines recorded out of ${fmtN(nDec)} decays: both photons must escape, with probability e<sup>−μL</sup> along the whole chord (μ = 0.096 /cm at 511 keV). The CT of the PET/CT gives μL for every line, so each line is counted e<sup>+μL</sup> times. ${p.tof ? 'Each line is back-projected as a Gaussian of the time-of-flight width, then a time-of-flight filter undoes the blur of back-projection.' : 'The lines are sorted by angle and offset (a sinogram); each row is ramp-filtered, then smeared back across the picture.'}`;
        return `Measured lesion contrast ${pl(r || 0, 3)}:1 against ${pl(expC(), 3)}:1 expected for this picture (true ${pl(p.U, 2)}:1). The picture’s ${pl(picF(), 3)} mm blur explains the drop from ${pl(p.U, 2)}:1; what is left is statistical noise, which shrinks as 1/√N${p.tof ? '. Time of flight keeps it small: try it off' : '. Time of flight would make it smaller for the same number of pairs'}.`;
      },
      tiles() {
        return [
          ['Each gamma ray', '511 keV', 'E = mc² of one electron'],
          ['Scanner sharpness', `${pl(res.fwhm, 2)} mm`, `this picture: ${pl(picF(), 2)} mm (fewer pairs)`],
          ['Time of flight', p.tof ? `±${pl(tofDx() / 20, 2)} cm` : 'off', p.tof ? `${p.tof} ps clocks: Δx = cΔt/2` : 'only “somewhere on this line”'],
          p.pairs ? ['Pairs recorded', fmtN(N), nDec ? `${pl(100 * N / nDec, 2)} % of decays: the body absorbed the rest` : 'both gamma rays must get out'] : ['Single flashes', fmtN(nSingles), 'one gamma ray each: no lines'],
        ];
      },
      graphA(cv) {
        const exp = expC(), pts = hist.map(([n, r]) => [Math.max(n, 1), r]);
        const r = plot(cv, { xmin: 100, xmax: NMAX, xlog: true, ymin: 0, ymax: Math.max(p.U * 1.25, 2, ...pts.map(q => q[1] * 1.1)), xlabel: 'pairs recorded', ylabel: 'cancer ÷ tissue around it', pad: { r: 16 },
          series: [{ pts: [[100, exp], [NMAX, exp]], color: 'rgba(255,214,140,0.8)', dash: [5, 5], width: 1.5 }, { pts: [[100, p.U], [NMAX, p.U]], color: 'rgba(150,220,255,0.6)', dash: [2, 4], width: 1.2 }, { pts, color: '#ffb0f4', width: 2.2, dot: pts.length > 0 }] });
        if (!r) return;
        const c = r.ctx; c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom';
        c.fillStyle = 'rgba(255,214,140,0.95)'; c.fillText(`expected in this picture (${pl(picF(), 2)} mm blur): ${pl(exp, 2)}×`, r.pad.l + 6, r.YP(exp) - 2);
        c.fillStyle = 'rgba(150,220,255,0.9)'; c.fillText(`true: ${pl(p.U, 2)}×`, r.pad.l + 6, r.YP(p.U) - 2);
        if (!p.pairs) { c.fillStyle = '#ffd590'; c.textAlign = 'center'; c.fillText('no lines, no picture: nothing to measure', r.pad.l + r.pw / 2, r.pad.t + r.ph / 2); }
      },
      graphB(cv) {
        const pts = [], ga = [], R0 = Rmm();
        for (let d = 1; d <= 8.01; d += 0.25) { pts.push([d, R.petRes({ d, R: R0, iso: p.iso, block: p.block }).fwhm]); ga.push([d, R.petRes({ d, R: R0, iso: 'f18', block: p.block }).fwhm]); }
        const r = plot(cv, { xmin: 1, xmax: 8, ymin: 0, ymax: Math.max(10, ...pts.map(q => q[1])) * 1.05, xlabel: 'crystal width (mm)', ylabel: 'blur, FWHM (mm)', pad: { r: 16 },
          series: [...(p.iso !== 'f18' ? [{ pts: ga, color: 'rgba(214,224,218,0.45)', width: 1.5, dash: [4, 4] }] : []), { pts, color: '#ffb0f4', width: 2.2 }] });
        if (!r) return;
        const c = r.ctx, x = r.XP(p.d), y = r.YP(res.fwhm); glow(c, x, y, 9, '255,176,244', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
        c.font = '600 10.5px "Barlow", sans-serif'; c.fillStyle = 'rgba(214,224,218,0.8)'; c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillText(`${iso().name}: positron range adds ${iso().s} mm; the angle adds ${pl(0.0044 * R0, 2)} mm`, r.pad.l + 6, r.pad.t + 16);
      },
      numbers() {
        const I = iso(), R0 = Rmm();
        let h = sec('The tracer');
        h += row('Decay', `${I.sym} → e⁺ + ν`, `In ${pl(I.beta * 100, 3)} % of decays a proton in the nucleus turns into a neutron and the charge leaves as a <b>positron</b>, the electron’s antiparticle.`, '');
        h += row('Positron energy', `up to ${I.emax} MeV`, `It slows down in the body and meets an electron after ${I.range} mm on average (in water). The faster the positrons, the more the picture blurs: ${I.s} mm here.`, '');
        h += sec('Matter meets antimatter');
        h += row('Each gamma ray', '511 keV', 'All of the pair’s mass becomes light: each photon carries the rest energy of one electron.', 'E = m<sub>e</sub>c² = 9.109 × 10⁻³¹ kg × (2.998 × 10⁸ m/s)² = 8.187 × 10⁻¹⁴ J = 511.0 keV');
        h += row('Direction', 'back to back, 180° ± 0.25°', 'The pair meets almost at rest, so its total momentum is almost zero; two photons can only keep it zero by flying apart in opposite directions. The small leftover momentum tilts them by about 0.25°.', `blur at the centre = R·δ/2 = 0.0044 × ${R0} mm = ${pl(0.0044 * R0, 3)} mm`);
        h += sec('The ring');
        h += row('Crystals', `${Math.round(TAU * R0 / p.d)} of ${p.d} mm`, `On a ${p.diam} cm circle. A line only knows which crystal fired, which blurs it by about half a crystal.`, `N = 2πR/d = 2π × ${R0} mm / ${p.d} mm; blur d/2 = ${pl(p.d / 2, 3)} mm`);
        h += row('Scanner sharpness', `${pl(res.fwhm, 3)} mm FWHM`, `Moses (2011): the blurs add in quadrature, and a clinical reconstruction adds about 25 %.${p.block ? ' Shared-light blocks add a decoding blur of d/3.' : ''}`, `Γ = 1.25 √((d/2)² + s² + (0.0044R)²${p.block ? ' + (d/3)²' : ''}) = 1.25 √(${pl(res.det, 3)}² + ${pl(res.rng, 3)}² + ${pl(res.acol, 3)}²${p.block ? ` + ${pl(res.dec, 3)}²` : ''}) mm`);
        if (p.tof) h += row('Time of flight', `±${pl(tofDx() / 2, 3)} mm`, `The photon that has less far to go arrives first. With clocks good to ${p.tof} ps the point is placed on its line to within Δx (FWHM).`, `Δx = cΔt/2 = 2.998 × 10⁸ m/s × ${p.tof} × 10⁻¹² s / 2 = ${pl(tofDx(), 3)} mm`);
        h += sec('Getting out of the body');
        h += row('Both photons escape', `e<sup>−μL</sup>`, 'Each photon can be absorbed or scattered on its way out; what counts is the whole chord L through the body, wherever on it the pair met. Through the middle of this chest (lungs included): ' + `${pl(100 * Math.exp(-(R.petMuL(ph, 0, 0, 0, 1) + R.petMuL(ph, 0, 0, 0, -1))), 3)} % top to bottom.`, `μ = 0.096 /cm in water at 511 keV; through 30 cm of water e<sup>−0.096 × 30</sup> = ${pl(100 * R.petAtt(30), 3)} %`);
        const muMid = R.petMuL(ph, 0, 0, 0, 1) + R.petMuL(ph, 0, 0, 0, -1);
        h += row('Attenuation correction', 'each line × e<sup>+μL</sup>', 'The CT half of a PET/CT measures μ everywhere, so the scanner knows μL for every line and counts it e<sup>μL</sup> times. Without this the middle of the body would look too dark.', `top to bottom through the middle: e<sup>μL</sup> = e<sup>${pl(muMid, 3)}</sup> = ${pl(Math.exp(muMid), 3)}`);
        h += row('Recorded', `${fmtN(N)} of ${fmtN(nDec)} decays`, 'Lines where both photons got out (this slice only; a real scanner records millions in a few minutes, in 3-D).', '');
        h += sec('Making the picture');
        if (p.tof) {
          h += row('Back-projection', 'each line, as a Gaussian', `Each line adds along itself, centred where the clocks put the pair, ${pl(tofDx(), 3)} mm wide at half height. A point source then looks like a short star.`, '');
          h += row('Filter', 'time-of-flight filter', 'Each line’s Gaussian (σ = Δx/2.355) meets the clocks’ own error (also σ), so back-projection turns a point into (1/r)·e<sup>−r²/4σ²</sup>. Its Fourier transform is πσ√(2π)·e<sup>−x</sup>I₀(x) with x = 2π²f²σ²; the filter divides by it.', '');
        } else {
          h += row('Sinogram', 'lines sorted by angle and offset', 'Without time of flight a line could have come from anywhere on it, so only its direction and its distance from the centre count.', '');
          h += row('Filter, then back-projection', 'ramp |f|', 'Each row gets the ramp filter (built from its sampled kernel), then is smeared back across the picture. Without the filter a point would come out as a star with a 1/r halo.', '');
        }
        h += row('Smoothing', `${pl(PX, 3)} mm pixels`, `Noise lives at the highest frequencies, so the filter is rolled off to zero there (a Hann window). A real scan records many millions of pairs and can smooth less; this one stops at ${fmtN(NMAX)}.`, '');
        h += row('This picture', `${pl(picF(), 3)} mm FWHM`, 'The scanner’s blur, the pixels and the smoothing together, as the width of a thin line in the picture.', '');
        h += row('Partial-volume effect', `${pl(expC(), 3)}× instead of ${pl(p.U, 2)}×`, `A cancer less than about 3 times the blur loses part of its brightness to its surroundings. Measured as a doctor would, over the ${p.D} mm disc against plain tissue 8–22 mm beyond its edge.`, `contrast recovery = (${pl(expC(), 3)} − 1) / (${pl(p.U, 2)} − 1) = ${pl(100 * (expC() - 1) / (p.U - 1), 3)} %`);
        return h;
      },
      check() {
        const vis = R.petRes({ d: 3.2, R: 410, iso: 'f18' });
        const rows = [
          ['Sharpness with 3.2 mm crystals', `${pl(vis.fwhm, 3)} mm`, '3.6 mm (Biograph Vision, measured)', 'vision', Math.abs(vis.fwhm / 3.6 - 1) <= 0.2 ? 'good' : 'warn'],
          ['Pairs escaping 20 cm of water', `1 in ${pl(1 / R.petAtt(20), 2)}`, 'about 1 in 7', 'aapm', Math.abs(1 / R.petAtt(20) / 7 - 1) < 0.1 ? 'good' : 'warn'],
          ['Pairs escaping 40 cm of water', `1 in ${pl(1 / R.petAtt(40), 2)}`, 'about 1 in 50', 'aapm', Math.abs(1 / R.petAtt(40) / 50 - 1) < 0.15 ? 'good' : 'warn'],
          ['From the middle of a 30 cm body', `${pl(100 * R.petAtt(30), 2)} % get out`, 'about 5 %', 'mu511', Math.abs(R.petAtt(30) - 0.05) < 0.01 ? 'good' : 'warn'],
          ['Each gamma ray', `${pl(R.C.me * R.C.c * R.C.c / R.C.e / 1e3, 4)} keV`, '511 keV (m<sub>e</sub>c²)', 'cernam2', 'good'],
          [`Positron range of ${iso().name}`, `${iso().range} mm (mean, water)`, `${iso().range} mm`, 'posrange', 'good'],
        ];
        return '<p class="hint">The same model against measured scanners and published numbers. Green: within 20 %.</p>' + cmpTable(rows)
          + '<p class="hint">The model leaves out scattered photons and accidental pairs (two unrelated photons that happen to arrive together), which real scanners correct for.</p>';
      },
      keyNumbers() {
        return row('Each gamma ray', '511 keV', 'The mass of one electron, turned into light: E = mc².')
          + row('Directions', 'opposite', 'The pair had almost no momentum, so the two gamma rays fly apart back to back.')
          + row('Sharpness', `${pl(res.fwhm, 2)} mm`, 'The scanner: crystal size, how far the positron travels and a tiny tilt.')
          + row('The cancer looks', `${pl(expC(), 2)}× (really ${pl(p.U, 2)}×)`, 'A small spot is smeared by the picture’s blur, so it looks dimmer than it is.')
          + row('Time of flight', p.tof ? `±${pl(tofDx() / 20, 2)} cm` : 'off', p.tof ? 'Light covers 3 cm in 100 picoseconds: the clocks tell where on the line.' : 'Each line only says the pair met somewhere on it.')
          + row('Lines recorded', fmtN(N), 'Most gamma rays are absorbed in the body; only pairs that both get out make a line.');
      },
      link(sm) {
        const rows = [
          ['What meets', 'e⁻ and e⁺ (the “Matter + antimatter” preset)', 'an electron in the body and a positron from the tracer'],
          ['Energy before', 'whatever you give them, plus 2 × 511 keV of mass', 'almost only the 2 × 511 keV of mass'],
          ['What comes out', 'two photons, back to back', 'two 511 keV gamma rays, back to back'],
        ];
        if (!sm) rows.push(['Total momentum', 'zero when the beams are equal and opposite', 'almost zero: the pair is nearly at rest'], ['How it is seen', 'tracks in your detector', 'two crystals in the ring fire together']);
        return {
          title: 'How is a PET scanner like your collider?',
          text: sm ? 'In the Collider, pick <b>Matter + antimatter</b>: an electron and a positron meet and their mass turns into light. A PET scanner watches exactly that happen inside a patient, again and again. Because the pair has almost no momentum, the two gamma rays fly apart back to back, and the ring of detectors, like the one around your collision, catches both.'
            : 'A head-on collision of equal beams has zero total momentum, so everything it makes can be at rest or fly apart symmetrically: your collider’s e⁻ + e⁺ → 2γ is the same event. In PET the positron has slowed almost to rest first, so √s ≈ 2m<sub>e</sub>c² = 1.022 MeV: exactly enough for two 511 keV photons and far too little for anything heavier. Momentum conservation then fixes their directions, and that is what makes the line.',
          cols: ['Your collider', 'A PET scanner'], rows, alt: 'Animation: on the left an electron and a positron collide head-on in your collider and two photons fly apart; on the right the same happens inside a patient in a ring of detectors',
          draw: (c, W, H, t) => twoPanels(c, W, H, t, (c2, w, h, t2) => {
            const T = 2.2, f = (t2 % T) / T, cx = w * 0.55, cy = h * 0.55, d = Math.min(w * 0.35, h * 0.45);
            if (f < 0.45) { const u = f / 0.45; glow(c2, cx - d * (1 - u), cy, 8, '120,180,255', 0.95); glow(c2, cx + d * (1 - u), cy, 8, '255,120,120', 0.95); text(c2, 'e⁻', cx - d * (1 - u), cy - 14, { size: 12, align: 'center', color: '#9fc8ff' }); text(c2, 'e⁺', cx + d * (1 - u), cy - 14, { size: 12, align: 'center', color: '#ffb0b0' }); }
            else { const u = (f - 0.45) / 0.55, a = 1.1; glow(c2, cx, cy, 18 * (1 - u) + 3, '255,255,255', 1 - u); for (const s2 of [-1, 1]) { const x = cx + s2 * Math.cos(a) * d * u, y = cy - s2 * Math.sin(a) * d * u; c2.strokeStyle = 'rgba(255,120,240,0.9)'; c2.lineWidth = 1.6; c2.beginPath(); c2.moveTo(cx, cy); c2.lineTo(x, y); c2.stroke(); glow(c2, x, y, 6, '255,150,240', 1); } }
            text(c2, 'your collider', 10, 15, { size: 13 }); text(c2, 'Matter + antimatter preset', 10, 33, { size: 12, color: '#9df5b8' });
            text(c2, 'equal and opposite: total momentum 0', 10, h - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
          }, (c2, w, h, t2) => {
            const cx = w * 0.58, cy = h * 0.55, rr = Math.min(w * 0.3, h * 0.38), T = 1.1, k = Math.floor(t2 / T), f = (t2 % T) / T;
            c2.strokeStyle = 'rgba(230,234,238,0.85)'; c2.lineWidth = 5; c2.beginPath(); c2.arc(cx, cy, rr, 0, TAU); c2.stroke();
            c2.fillStyle = 'rgba(214,170,150,0.22)'; c2.beginPath(); c2.ellipse(cx, cy, rr * 0.62, rr * 0.42, 0, 0, TAU); c2.fill();
            const ox = cx + (hash(k) - 0.5) * rr * 0.6, oy = cy + (hash(k + 9) - 0.5) * rr * 0.4, a = hash(k + 3) * Math.PI, dx = Math.cos(a), dy = Math.sin(a);
            const tt = -(dx * (ox - cx) + dy * (oy - cy)), disc = Math.sqrt(tt * tt - ((ox - cx) ** 2 + (oy - cy) ** 2 - rr * rr)), t1 = tt + disc, t2b = tt - disc;
            const u = Math.min(1, f * 1.6);
            c2.strokeStyle = 'rgba(255,120,240,0.9)'; c2.lineWidth = 1.5; c2.beginPath(); c2.moveTo(ox + dx * t2b * u, oy + dy * t2b * u); c2.lineTo(ox + dx * t1 * u, oy + dy * t1 * u); c2.stroke();
            glow(c2, ox, oy, 10 * (1 - u) + 3, '255,255,255', 0.9); if (u >= 1) { glow(c2, ox + dx * t1, oy + dy * t1, 8, '255,170,250', 1); glow(c2, ox + dx * t2b, oy + dy * t2b, 8, '255,170,250', 1); }
            text(c2, 'a PET scanner', 10, 15, { size: 13 }); text(c2, 'e⁻ + e⁺ → two 511 keV gamma rays', 10, 33, { size: 12, color: '#9df5b8' });
            text(c2, 'the pair is almost at rest: back to back', 10, h - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
          }),
        };
      },
      sources: ['moses', 'vision', 'posrange', 'mu511', 'aapm', 'ctac', 'kak', 'pve', 'cernam2'],
      whySources: ['nopr', 'cernam', 'cernmed', 'acs'],
      get without() { return !p.pairs; },
      setWithout(b) { p.pairs = !b; },
      why(sm) {
        const C = expC();
        return {
          q: 'Why put antimatter inside a patient?',
          a: sm ? `To see where a cancer is alive and growing. Cancer cells eat more sugar, so doctors inject sugar carrying ${iso().name}, which shoots out <b>antimatter</b>: positrons. Each one meets an ordinary electron within about a millimetre and both vanish into two gamma rays that fly apart in exactly opposite directions. A ring of detectors catches both and draws a line between them; thousands of lines cross where the cancer is.`
            : 'Antimatter gives every flash a direction. A positron and an electron that meet almost at rest have almost no momentum, so their two 511 keV photons (E = mc² each) must leave back to back. Two crystals firing together define a line through the decay; with time of flight, also a short stretch of it. One photon on its own only says that something, somewhere, decayed.',
          metric: `How bright the ${p.D} mm cancer looks in the picture, compared with the tissue around it`,
          mark: { v: p.U, label: `it really takes up ${pl(p.U, 2)}× the sugar` },
          pick: true,
          rows: [
            { k: 'off', label: 'One gamma ray per decay, same ring', v: 1, txt: '1×: no picture', cur: !p.pairs },
            { k: 'on', label: 'Antimatter: two gamma rays, back to back', v: C, txt: `${pl(C, 2)}× as bright`, cur: p.pairs },
          ],
          verdict: 'Seeing where cancer eats sugar changes what doctors do: in a US registry of 22,975 PET scans, doctors changed the plan for <b>36.5 % of patients</b>.',
        };
      },
      helps(sm) {
        const r = ratioNow();
        return [
          ['people', 'Cancer patients', 'After PET, doctors changed the plan for 36.5 % of 22,975 patients; of those who were due for a biopsy, about 70 % no longer needed it.', 'nopr'],
          ['beam', 'Antimatter, every day', 'Positrons are antimatter, and hospitals use them every day: a PET scanner is a tiny matter–antimatter collider with a detector round it.', 'cernam'],
          ['scan', 'The brain at work', 'PET also shows which parts of the brain are busy, for example while a person reads words.', 'cernam2'],
          ['chart', 'From particle physics', 'New crystals, small fast light sensors and reconstruction: PET scanners and collider detectors face the same problems.', 'cernmed'],
          ['person', 'This scan', p.pairs ? (N ? `${fmtN(N)} lines from ${fmtN(nDec)} decays${r ? `: the ${p.D} mm cancer shows ${pl(r, 2)}× its surroundings` : ''}.` : `Start the scan: a ${p.D} mm cancer that eats ${pl(p.U, 2)}× the sugar.`) : 'One gamma ray per decay: flashes, but no lines and no picture.', ''],
        ];
      },
    };
    return sim;
  }

  /* =====================================================================
     8. ELECTRON MICROSCOPE — the aurora's spiral, put to work (in the Cyclotron station)
     Electrons sped up through V volts behave like waves 200,000 times shorter than light. A magnetic lens focuses
     them: in the coil's field each electron circles, r = p sin a/eB, exactly like the aurora's electrons round
     Earth's field lines, and because the period T = 2πγm/eB does not depend on how fast it moves sideways, every
     electron is back on the axis after one turn. Light, or electrons: the same coronavirus, seen by each.
     ===================================================================== */
  function makeTEM() {
    const E = R.EMS;
    const p = { kV: 200, L: 5, a: 10, mode: 'em', spec: 'virus', fov: 400, trim: 0 };
    const SPEC = {
      cell: { t: 'Red blood cell', sub: 'about 8 µm across', fov: 16000, note: 'A red blood cell is a disc about 8 µm across and 2 µm thick. Light microscopes show it well: it is 40 times bigger than their limit.' },
      bacterium: { t: 'Bacterium', sub: 'E. coli · 2 µm', fov: 5000, note: 'E. coli is about 2 µm long and 0.5 µm wide. Light shows the cell; its flagella, the whips it swims with, are only about 20 nm thick: ten times below light’s limit.' },
      virus: { t: 'Coronavirus', sub: 'about 0.1 µm', fov: 400, note: 'The virus behind COVID-19: particles 60 to 140 nm across with spikes 9 to 12 nm long, the crown that gave coronaviruses their name. Half the size of light’s limit.' },
    };
    const ctls = {};
    let t = 0, done = false, specCv = null, specKey = '', lightCv = null, lightKey = '', noiseCv = null, smallCv = null, imgCv = null, spin = 0;
    const TRUN = 5;
    const el = () => R.emElectron(p.kV);
    const Lm = () => p.L / 1000, am = () => p.a / 1000;
    const Bfocus = () => R.emFocusB(p.kV, Lm());
    const Bnow = () => Math.min(Bfocus() * (1 + p.trim / 1000), E.Bmax);
    const tooStrong = () => Bfocus() * (1 + p.trim / 1000) > E.Bmax + 1e-9;
    const dRes = () => (p.mode === 'light' ? R.emLight() : R.emScherzer(p.kV, R.emCs(Lm())));                   // m
    const dBlur = () => (p.mode === 'light' ? 0 : 2 * R.emBlur(p.kV, Bnow(), am(), Lm() * Math.cos(am())));     // m, the defocus disc
    const dTot = () => Math.hypot(dRes(), dBlur());
    const fmtL = m => (m >= 1e-6 ? `${pl(m * 1e6, 3)} µm` : m >= 1e-10 ? `${pl(m * 1e9, 3)} nm` : `${pl(m * 1e12, 3)} pm`);
    const round2 = n => Number(n.toPrecision(2)).toLocaleString('en-US');
    const fmtNm = nm => (nm >= 1000 ? `${pl(nm / 1000, 3)} µm` : `${pl(nm, 3)} nm`);
    function reset() { t = 0; done = false; }
    function step(dts) { t = Math.min(TRUN, t + dts); spin += dts; if (t >= TRUN) done = true; return done; }

    /* ---- the specimens, drawn in nanometres ---- */
    function drawSpecimen(g, S, fov, light) {
      const k = S / fov, X = x => S / 2 + x * k, Y = y => S / 2 - y * k;
      const bg = light ? '#ebe3d4' : '#c9cbc5', dark = light ? 'rgba(120,60,110,0.95)' : '#3c413e', mid = light ? 'rgba(160,90,140,0.55)' : '#868b86';
      g.fillStyle = bg; g.fillRect(0, 0, S, S);
      if (!light) { for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(80,86,82,${0.03 + 0.05 * hash(i + 3)})`; g.beginPath(); g.arc(hash(i) * S, hash(i + 70) * S, (2 + 6 * hash(i + 9)) * Math.max(1, S / 300), 0, TAU); g.fill(); } }
      if (p.spec === 'virus') {
        const V = [[0, 0, 50], [-175, 95, 44], [160, -125, 56], [250, 170, 47], [-260, -190, 52], [420, -10, 50]];
        V.forEach(([x0, y0, r], vi) => {
          const cx = X(x0), cy = Y(y0); if (cx < -r * k * 2 || cx > S + r * k * 2 || cy < -r * k * 2 || cy > S + r * k * 2) return;
          const n = Math.round(r * 0.5);
          g.strokeStyle = dark; g.fillStyle = dark; g.lineCap = 'round';
          for (let i = 0; i < n; i++) { const a = TAU * (i + hash(vi * 31 + i) * 0.4) / n, c1 = Math.cos(a), s1 = Math.sin(a); g.lineWidth = Math.max(0.6, 2.4 * k); g.beginPath(); g.moveTo(cx + c1 * r * k, cy + s1 * r * k); g.lineTo(cx + c1 * (r + 8) * k, cy + s1 * (r + 8) * k); g.stroke(); g.beginPath(); g.ellipse(cx + c1 * (r + 10) * k, cy + s1 * (r + 10) * k, Math.max(0.5, 4.2 * k), Math.max(0.5, 3 * k), a, 0, TAU); g.fill(); }
          g.fillStyle = mid; g.beginPath(); g.arc(cx, cy, r * k, 0, TAU); g.fill();
          g.fillStyle = light ? 'rgba(120,60,110,0.35)' : 'rgba(60,64,62,0.55)';
          for (let i = 0; i < 26; i++) { const a = TAU * hash(vi * 7 + i), rr = r * 0.8 * Math.sqrt(hash(vi * 13 + i + 5)); g.beginPath(); g.arc(cx + Math.cos(a) * rr * k, cy + Math.sin(a) * rr * k, Math.max(0.5, (3 + 3 * hash(i + vi)) * k), 0, TAU); g.fill(); }
          g.strokeStyle = dark; g.lineWidth = Math.max(0.7, 5 * k); g.beginPath(); g.arc(cx, cy, r * k, 0, TAU); g.stroke();
        });
      } else if (p.spec === 'bacterium') {
        const ang = 0.32, L = 2000, Wd = 500, ca = Math.cos(ang), sa = Math.sin(ang);
        // flagella: helical filaments about 20 nm thick, 5–10 µm long, helical pitch about 2.3 µm and diameter about 0.5 µm.
        // For light they are thin and take up almost no stain (special stains coat them to make them visible), so they are faint
        g.strokeStyle = light ? 'rgba(120,60,110,0.1)' : dark; g.lineWidth = Math.max(0.5, 20 * k);
        for (let f = 0; f < 5; f++) {
          const s0 = -L / 2 + 200 + f * 380, side = f % 2 ? 1 : -1, bx = s0 * ca - side * Wd / 2 * sa, by = s0 * sa + side * Wd / 2 * ca, dir = ang + side * (0.9 + 0.25 * f) + Math.PI * (f > 2 ? 1 : 0);
          g.beginPath();
          for (let u = 0; u <= 1; u += 0.01) { const sx = u * 6500, sy = 250 * Math.sin(TAU * sx / 2300 + f), x = bx + sx * Math.cos(dir) - sy * Math.sin(dir), y = by + sx * Math.sin(dir) + sy * Math.cos(dir); u ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); }
          g.stroke();
        }
        g.save(); g.translate(X(0), Y(0)); g.rotate(-ang);
        g.fillStyle = mid; rrect(g, -L / 2 * k, -Wd / 2 * k, L * k, Wd * k, Wd / 2 * k); g.fill();
        g.fillStyle = light ? 'rgba(120,60,110,0.3)' : 'rgba(55,60,58,0.45)'; for (let i = 0; i < 260; i++) { g.beginPath(); g.arc((hash(i) - 0.5) * (L - Wd * 0.6) * k, (hash(i + 400) - 0.5) * Wd * 0.75 * k, Math.max(0.4, 11 * k), 0, TAU); g.fill(); }
        g.strokeStyle = dark; g.lineWidth = Math.max(0.6, 24 * k); rrect(g, -L / 2 * k, -Wd / 2 * k, L * k, Wd * k, Wd / 2 * k); g.stroke();
        g.restore();
      } else {
        const r = 3900, cx = X(0), cy = Y(0);
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * k);
        if (light) { gr.addColorStop(0, 'rgba(225,140,140,0.55)'); gr.addColorStop(0.55, 'rgba(200,70,80,0.75)'); gr.addColorStop(0.9, 'rgba(175,40,55,0.95)'); gr.addColorStop(1, 'rgba(175,40,55,0.2)'); }
        else { gr.addColorStop(0, '#9a9f9a'); gr.addColorStop(0.55, '#6f746f'); gr.addColorStop(0.9, '#3f4441'); gr.addColorStop(1, 'rgba(63,68,65,0.3)'); }
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * k, 0, TAU); g.fill();
        for (const [x0, y0, rr] of [[-6800, 5200, 3700], [6900, -4800, 3800]]) { const g2 = g.createRadialGradient(X(x0), Y(y0), 0, X(x0), Y(y0), rr * k); g2.addColorStop(0, light ? 'rgba(225,140,140,0.5)' : '#9a9f9a'); g2.addColorStop(0.9, light ? 'rgba(175,40,55,0.9)' : '#454a47'); g2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = g2; g.beginPath(); g.arc(X(x0), Y(y0), rr * k, 0, TAU); g.fill(); }
      }
    }
    function specCanvas(S, light) {
      const key = `${p.spec}|${p.fov}|${S}`;
      if (light) { if (lightKey !== key) { lightKey = key; lightCv = lightCv || document.createElement('canvas'); lightCv.width = lightCv.height = S; drawSpecimen(lightCv.getContext('2d'), S, p.fov, true); } return lightCv; }
      if (specKey !== key) { specKey = key; specCv = specCv || document.createElement('canvas'); specCv.width = specCv.height = S; drawSpecimen(specCv.getContext('2d'), S, p.fov, false); }
      return specCv;
    }
    // blur by drawing small and scaling back up (works in every browser); sigma in pixels of the S × S picture
    function blurred(src, S, sigma) {
      if (sigma < 0.6) return src;
      const f = clamp(1 / (sigma * 1.6), 1 / S, 1), n = Math.max(2, Math.round(S * f));
      if (!smallCv) smallCv = document.createElement('canvas');
      if (!imgCv) imgCv = document.createElement('canvas');
      smallCv.width = smallCv.height = n; const sg = smallCv.getContext('2d'); sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high'; sg.drawImage(src, 0, 0, n, n);
      imgCv.width = imgCv.height = S; const ig = imgCv.getContext('2d'); ig.imageSmoothingEnabled = true; ig.imageSmoothingQuality = 'high'; ig.drawImage(smallCv, 0, 0, S, S);
      return imgCv;
    }
    function noise(S) {
      if (noiseCv && noiseCv.width === S) return noiseCv;
      noiseCv = document.createElement('canvas'); noiseCv.width = noiseCv.height = S; const g = noiseCv.getContext('2d'), id = g.createImageData(S, S);
      for (let i = 0; i < S * S; i++) { const v = Math.random() * 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
      g.putImageData(id, 0, 0); return noiseCv;
    }
    function scaleBar(fov) { const target = fov / 4, e10 = Math.pow(10, Math.floor(Math.log10(target))); const m = target / e10 >= 5 ? 5 : target / e10 >= 2 ? 2 : 1; return m * e10; }
    function drawScreen(c, x, y, S, sm) {
      const light = p.mode === 'light', SS = 360, src = specCanvas(SS, light);
      const sigma = dTot() * 1e9 / p.fov * SS / 2.3548, img = blurred(src, SS, sigma), prog = light ? 1 : clamp(t / TRUN, 0, 1);
      c.save(); rrect(c, x, y, S, S, 6); c.clip();
      c.fillStyle = '#050607'; c.fillRect(x, y, S, S);
      if (prog > 0 || light) {
        c.globalAlpha = light ? 1 : Math.min(1, 0.25 + prog); c.imageSmoothingEnabled = true; c.drawImage(img, x, y, S, S); c.globalAlpha = 1;
        if (!light) { c.globalAlpha = 0.55 * Math.pow(1 - prog, 0.6) + 0.07; c.globalCompositeOperation = 'overlay'; c.drawImage(noise(256), x, y, S, S); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
      } else text(c, 'beam off', x + S / 2, y + S / 2, { size: 13, align: 'center', color: 'rgba(214,224,218,0.6)' });
      if (tooStrong() && !light) { c.fillStyle = 'rgba(40,10,10,0.55)'; c.fillRect(x, y, S, S); text(c, 'the lens cannot focus:', x + S / 2, y + S / 2 - 10, { size: 13, align: 'center', color: '#ffb0a0' }); text(c, `it would need ${pl(Bfocus(), 3)} T; iron gives about ${E.Bmax} T`, x + S / 2, y + S / 2 + 10, { size: 11.5, align: 'center', color: '#ffd0c0' }); }
      // scale bar
      const bar = scaleBar(p.fov), bw = bar / p.fov * S;
      c.fillStyle = 'rgba(0,0,0,0.55)'; rrect(c, x + 8, y + S - 30, bw + 16, 22, 4); c.fill();
      c.fillStyle = '#fff'; c.fillRect(x + 16, y + S - 14, bw, 3);
      text(c, fmtNm(bar), x + 16 + bw / 2, y + S - 21, { size: 11, align: 'center', color: '#fff', halo: 0 });
      c.restore();
      c.strokeStyle = light ? 'rgba(255,230,180,0.5)' : 'rgba(140,255,170,0.45)'; c.lineWidth = 1.2; rrect(c, x + 0.5, y + 0.5, S - 1, S - 1, 6); c.stroke();
      text(c, light ? (sm ? 'Through a light microscope' : 'Light microscope: green light, oil immersion') : (sm ? 'On the electron microscope’s screen' : `TEM, ${p.kV} kV`), x, y - 14, { size: 13, color: '#e6ece8' });
      if (!light && tooStrong()) text(c, 'no picture: the lens cannot focus', x, y + S + 14, { size: 12, color: '#ffb0a0' });
      else text(c, `finest detail ${fmtL(dRes())}${!light && dBlur() > dRes() * 0.3 ? ` · out of focus by ${fmtL(dBlur())}` : ''}`, x, y + S + 14, { size: 12, color: light ? '#ffd590' : dBlur() > dRes() * 0.3 ? '#ffb0a0' : '#9df5b8' });
    }

    /* ---- the column: gun, lenses, specimen, the spiralling electrons, the screen ---- */
    function coil(c, cx, y, half, wide, h, hot) {
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? cx - half - wide : cx + half;
        c.fillStyle = '#2f353a'; rrect(c, x0 - 3, y - 3, wide + 6, h + 6, 5); c.fill();
        const g = c.createLinearGradient(x0, y, x0 + wide, y); g.addColorStop(0, '#8f4c1f'); g.addColorStop(0.5, hot ? '#e7a15c' : '#c9803f'); g.addColorStop(1, '#8f4c1f');
        c.fillStyle = g; rrect(c, x0, y, wide, h, 3); c.fill();
        c.strokeStyle = 'rgba(60,25,5,0.35)'; c.lineWidth = 1; for (let yy = y + 3; yy < y + h - 1; yy += 3) { c.beginPath(); c.moveTo(x0 + 1, yy); c.lineTo(x0 + wide - 1, yy); c.stroke(); }
      }
    }
    function drawColumn(c, X0, Y0, w, h, sm, dtr, running) {
      const cx = X0 + w * 0.34, tt = performance.now() / 1000, on = t > 0 && !tooStrong();
      const yGun = Y0 + h * 0.03, yAcc = Y0 + h * 0.12, yCon = Y0 + h * 0.27, ySpec = Y0 + h * 0.42, yFoc = Y0 + h * 0.62, yPro = Y0 + h * 0.72, yScr = Y0 + h * 0.93;
      const half = Math.min(w * 0.09, 26);
      // the vacuum tube
      c.fillStyle = 'rgba(30,38,44,0.85)'; rrect(c, cx - half, yGun, half * 2, yScr - yGun + 6, 8); c.fill();
      c.strokeStyle = 'rgba(214,224,218,0.18)'; c.lineWidth = 1; rrect(c, cx - half, yGun, half * 2, yScr - yGun + 6, 8); c.stroke();
      // gun and accelerator
      c.fillStyle = '#5b646b'; rrect(c, cx - half * 1.5, yGun, half * 3, h * 0.07, 6); c.fill();
      c.strokeStyle = '#ffd08a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx - 5, yGun + h * 0.03); c.lineTo(cx, yGun + h * 0.055); c.lineTo(cx + 5, yGun + h * 0.03); c.stroke();
      if (on) glow(c, cx, yGun + h * 0.056, 8, '255,210,140', 0.9);
      for (let i = 0; i < 6; i++) { const yy = yAcc + i * h * 0.022; c.fillStyle = i % 2 ? '#3d454b' : '#4b545a'; rrect(c, cx - half * 1.25, yy, half * 2.5, h * 0.016, 3); c.fill(); }
      // the beam down to the specimen, squeezed by the condenser
      if (on) { c.strokeStyle = 'rgba(120,200,255,0.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, yGun + h * 0.06); c.lineTo(cx, ySpec); c.stroke(); }
      coil(c, cx, yCon, half, Math.min(w * 0.14, 40), h * 0.06, false);
      // specimen holder: a rod slid in from the side (here from the left, clear of the labels)
      c.fillStyle = '#9aa3a8'; c.fillRect(cx - w * 0.3, ySpec - 2, w * 0.3 + 2, 4); c.fillStyle = '#7d868c'; c.fillRect(cx - w * 0.3 - 5, ySpec - 5, 7, 10); c.fillStyle = '#d8dde0'; c.fillRect(cx - 8, ySpec - 3, 16, 6);
      // objective lens: iron pole pieces round a big coil; the field B runs along the axis
      const wO = Math.min(w * 0.18, 54); coil(c, cx, ySpec - h * 0.01, half, wO, yFoc - ySpec, on);
      c.fillStyle = 'rgba(170,160,255,0.08)'; c.fillRect(cx - half + 2, ySpec + 4, half * 2 - 4, yFoc - ySpec - 6);
      for (let yy = ySpec + 14; yy < yFoc - 6; yy += 20) { c.strokeStyle = 'rgba(190,180,255,0.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx - half + 7, yy - 5); c.lineTo(cx - half + 7, yy + 5); c.moveTo(cx - half + 4, yy + 2); c.lineTo(cx - half + 7, yy + 5); c.lineTo(cx - half + 10, yy + 2); c.stroke(); }
      // the spiralling electrons, seen from the side (sideways motion hugely enlarged)
      const B = Bnow(), e = el(), vz = e.v * Math.cos(am()), w0 = R.C.e * B / (e.gam * R.C.me), Tturn = Lm() / vz, sx = (half - 3) / Math.max(2 * e.v * Math.sin(am()) / w0, 1e-12);
      const N = 8;
      if (on || t === 0) for (let k = 0; k < N; k++) {
        const ph0 = TAU * k / N;
        c.strokeStyle = `hsla(${200 + 20 * Math.sin(ph0)},90%,${62 + 12 * Math.cos(ph0)}%,${on ? 0.75 : 0.25})`; c.lineWidth = 1.3; c.beginPath();
        for (let i = 0; i <= 60; i++) { const tt2 = Tturn * i / 60, q = R.emPath(p.kV, B, am(), ph0, tt2), yy = ySpec + (yFoc - ySpec) * (q.z / Lm()), xx = cx + q.x * sx; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
        c.stroke();
        if (on && !reduceMotion) { const u = ((tt * 0.45 + k / N) % 1), q = R.emPath(p.kV, B, am(), ph0, Tturn * u); const depth = 0.5 + 0.5 * Math.sin(Math.atan2(q.y, q.x)); glow(c, cx + q.x * sx, ySpec + (yFoc - ySpec) * (q.z / Lm()), 3 + 2 * depth, '150,220,255', 0.95); }
      }
      // after the focus: the projector lens spreads the image over the screen
      coil(c, cx, yPro, half * 0.8, Math.min(w * 0.11, 32), h * 0.05, false);
      if (on) { c.strokeStyle = 'rgba(120,200,255,0.4)'; c.lineWidth = 1.2; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx, yFoc); c.lineTo(cx + s * half * 0.3, yPro + h * 0.025); c.lineTo(cx + s * half * 1.6, yScr); c.stroke(); } }
      // the screen
      c.fillStyle = on ? 'rgba(80,255,140,0.55)' : 'rgba(80,255,140,0.12)'; c.fillRect(cx - half * 1.8, yScr, half * 3.6, 5);
      if (on) glow(c, cx, yScr + 2, half * 2.2, '80,255,140', 0.35);
      // labels
      // labels, most important first; on a short column the ones that would overlap are left out
      const lx = cx + half + wO + 8, used = [], L2 = (s, y, col) => { if (used.some(y0 => Math.abs(y0 - y) < 13)) return; used.push(y); text(c, s, lx, y, { size: 11.5, color: col || 'rgba(214,224,218,0.85)' }); };
      L2(sm ? 'electron gun' : `gun: ${p.kV} kV`, yGun + h * 0.035);
      L2(sm ? 'magnetic lens' : `objective: B = ${pl(B, 3)} T`, ySpec + (yFoc - ySpec) * 0.3, '#c8c0ff');
      L2('screen', yScr + 2, '#9df5b8');
      L2(sm ? 'meet again: focus' : `focus after one turn: ${p.L} mm`, yFoc, '#9df5b8');
      L2('specimen', ySpec, '#e6ece8');
      if (!sm) L2(`r = ${fmtL(R.emHelix(p.kV, B, am()).r)} (drawn ${Math.round(sx / ((yFoc - ySpec) / Lm()))}× wider)`, ySpec + (yFoc - ySpec) * 0.55, '#9fd8ff');
      L2(sm ? `speeds them to ${pl(e.beta, 2)} c` : `v = ${pl(e.beta, 3)} c, λ = ${pl(e.lambda * 1e12, 3)} pm`, yAcc + h * 0.06, '#9fd8ff');
      L2('condenser lens', yCon + h * 0.03);
      L2('projector lens', yPro + h * 0.025);
      if (on) glow(c, cx, yFoc, 6, '200,255,220', 0.9);
      return { cx, half, ySpec, yFoc, B, w0, sx };
    }
    // the same electrons seen along the beam: circles that all pass through the middle
    function drawEndOn(c, x, y, r, sm) {
      const e = el(), B = Bnow(), h = R.emHelix(p.kV, B, am()), on = t > 0 && !tooStrong(), tt = performance.now() / 1000;
      c.fillStyle = 'rgba(6,10,14,0.88)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(214,224,218,0.35)'; c.lineWidth = 1; c.stroke();
      const s = r * 0.42 / Math.max(h.r, 1e-12), N = 8;
      for (let k = 0; k < N; k++) {
        const ph0 = TAU * k / N, ccx = x - h.r * Math.sin(ph0) * s, ccy = y - h.r * Math.cos(ph0) * s;
        c.strokeStyle = `hsla(${200 + 20 * Math.sin(ph0)},90%,65%,0.6)`; c.lineWidth = 1.2; c.beginPath(); c.arc(ccx, ccy, h.r * s, 0, TAU); c.stroke();
        if (on && !reduceMotion) { const u = (tt * 0.45 + k / N) % 1, q = R.emPath(p.kV, B, am(), ph0, h.T * u); glow(c, x + q.x * s, y - q.y * s, 4, '150,220,255', 0.95); }
      }
      glow(c, x, y, 5, '200,255,220', 0.9);
      text(c, sm ? 'seen along the beam' : 'along the beam', x, y - r - 9, { size: 11, align: 'center', color: '#cfe8ff' });
      text(c, sm ? 'each circles, back to the middle' : `T = 2πγm/eB = ${pl(h.T * 1e12, 3)} ps`, x, y + r + 11, { size: 11, align: 'center', color: '#9fd8ff' });
    }
    // the light microscope: lamp, condenser, specimen, glass objective, eyepiece; light rays focused by glass
    function drawLightScope(c, X0, Y0, w, h, sm) {
      const cx = X0 + w / 2, yEye = Y0 + h * 0.05, yObj = Y0 + h * 0.4, ySpec = Y0 + h * 0.58, yCon = Y0 + h * 0.72, yLamp = Y0 + h * 0.9;
      c.fillStyle = '#c8ced2'; rrect(c, cx - w * 0.05, yEye, w * 0.1, yObj - yEye, 5); c.fill();
      c.fillStyle = '#e0e4e6'; rrect(c, cx - w * 0.08, yEye - 4, w * 0.16, h * 0.06, 4); c.fill();
      c.fillStyle = '#d0d6da'; rrect(c, cx - w * 0.06, yObj - 6, w * 0.12, h * 0.08, 4); c.fill();
      c.fillStyle = '#8b959b'; c.fillRect(cx - w * 0.3, ySpec - 3, w * 0.6, 6);
      c.fillStyle = '#9aa3a8'; rrect(c, cx - w * 0.06, yCon - 6, w * 0.12, h * 0.06, 4); c.fill();
      glow(c, cx, yLamp, w * 0.14, '255,240,200', 0.8); c.fillStyle = '#fff3d6'; c.beginPath(); c.arc(cx, yLamp, 7, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(140,255,150,0.55)'; c.lineWidth = 1.3;
      for (const s of [-1, -0.5, 0.5, 1]) { c.beginPath(); c.moveTo(cx + s * w * 0.04, yLamp); c.lineTo(cx + s * w * 0.06, yCon); c.lineTo(cx, ySpec); c.lineTo(cx + s * w * 0.045, yObj + h * 0.02); c.lineTo(cx + s * w * 0.01, yEye + h * 0.06); c.stroke(); }
      for (const yy of [yObj + h * 0.015, yCon + h * 0.01]) { c.fillStyle = 'rgba(200,235,255,0.7)'; c.beginPath(); c.ellipse(cx, yy, w * 0.055, 4, 0, 0, TAU); c.fill(); }
      const lx = cx + w * 0.11, L2 = (s, y, col) => text(c, s, lx, y, { size: 11.5, color: col || 'rgba(214,224,218,0.85)' });
      L2('eyepiece', yEye + h * 0.02); L2(sm ? 'glass lens' : 'objective: glass, NA 1.4', yObj + h * 0.02, '#c8f0ff'); text(c, 'specimen', cx + w * 0.3 + 8, ySpec, { size: 11.5, color: '#e6ece8' }); L2('condenser', yCon); L2(sm ? 'lamp: green light' : 'lamp: λ = 550 nm', yLamp, '#9df5b8');
    }
    function draw2d(c, W, H, dtr, running) {
      const sm = simple(), light = p.mode === 'light', wide = W >= 640;
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1014'); g.addColorStop(1, '#05080a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (wide) {
        const cw = Math.min(W * 0.3, 330), S = Math.min(W - cw - 276, H - 64), sx0 = W - S - 70, gap = sx0 - cw;
        if (light) drawLightScope(c, 12, 14, cw, H - 28, sm); else { drawColumn(c, 8, 12, cw, H - 24, sm, dtr, running); drawEndOn(c, cw + gap / 2, H * 0.47, Math.min(gap * 0.36, H * 0.22, 78), sm); }
        drawScreen(c, sx0, (H - S) / 2 + 8, S, sm);
      } else {
        const S = Math.min(W - 24, H * 0.52);
        drawScreen(c, (W - S) / 2, 40, S, sm);
        if (light) drawLightScope(c, 0, S + 62, W * 0.7, H - S - 68, sm); else { drawColumn(c, 0, S + 62, W * 0.62, H - S - 68, sm, dtr, running); drawEndOn(c, W * 0.82, S + 62 + (H - S - 68) / 2, Math.min(44, (H - S - 68) * 0.32, W * 0.15), sm); }
      }
    }

    /* ---- 3D: the microscope in its lab, cut open to show the beam; a light microscope on the bench beside it ---- */
    function draw3d(sc, c, W, H, dtr, running) {
      const light = p.mode === 'light', on = t > 0 && !tooStrong() && !light, tt = performance.now() / 1000;
      sc.begin(c, W, H, { bg: [18, 22, 26], fogNear: 1.5, fogFar: 4.2, fogMax: 0.45 });
      sc.floor(0, -3, 3, -2.5, 2.5, { rgb: [150, 156, 160], light: [255, 255, 255], lightA: 0.07, step: 0.5, gridColor: 'rgba(90,100,110,0.12)' });
      sc.box([0, 2.45, 1.5], [3, 0.05, 1.5], { rgb: [140, 156, 168], amb: 0.6 });
      // the column (semi-transparent so the beam inside shows)
      const st = (rgb, a = 0.38) => ({ rgb, a, amb: 0.62, spec: 0.4, shin: 30 });
      sc.box([0, 0, 0.45], [0.55, 0.45, 0.45], { rgb: [200, 206, 210], amb: 0.6, spec: 0.2 });
      sc.cyl([0, 0, 0.9], [0, 0, 1.12], 0.28, st([214, 220, 224], 0.5), 28);
      sc.cyl([0, 0, 1.12], [0, 0, 1.3], 0.17, st([190, 196, 200]), 24);
      sc.cyl([0, 0, 1.3], [0, 0, 1.42], 0.2, st([196, 128, 64], 0.55), 24);
      sc.cyl([0, 0, 1.42], [0, 0, 1.62], 0.15, st([190, 196, 200]), 24);
      sc.cyl([0, 0, 1.62], [0, 0, 1.8], 0.25, st([206, 136, 70], 0.55), 28);
      sc.cyl([0.05, 0, 1.74], [0.55, 0, 1.74], 0.025, { rgb: [190, 196, 200], spec: 0.6, flat: true }, 10);
      sc.cyl([0, 0, 1.8], [0, 0, 2.0], 0.15, st([190, 196, 200]), 24);
      sc.cyl([0, 0, 2.0], [0, 0, 2.08], 0.19, st([196, 128, 64], 0.55), 24);
      sc.cyl([0, 0, 2.08], [0, 0, 2.6], 0.22, st([220, 224, 228], 0.45), 28);
      sc.cyl([0, 0, 2.6], [0, 0, 2.7], 0.15, st([180, 186, 190], 0.6), 20);
      // the beam along the axis, and the spiral in the objective lens (drawn about 3000× wider than it is)
      if (on) {
        sc.line([0, 0, 2.62], [0, 0, 1.8], 'rgba(130,210,255,0.85)', 2, { glow: 'rgba(120,200,255,0.8)', layer: 'front' });
        const B = Bnow(), h = R.emHelix(p.kV, B, am()), N = 6, R3 = 0.06;
        for (let k = 0; k < N; k++) {
          const ph0 = TAU * k / N, pts = [];
          for (let i = 0; i <= 50; i++) { const q = R.emPath(p.kV, B, am(), ph0, h.T * i / 50); pts.push([q.x / Math.max(2 * h.r, 1e-12) * R3, q.y / Math.max(2 * h.r, 1e-12) * R3, 1.74 - 0.32 * q.z / Lm()]); }
          sc.path(pts, `hsla(${200 + 20 * Math.sin(ph0)},90%,65%,0.9)`, 1.6, { glow: 'rgba(120,200,255,0.6)', layer: 'front', chunk: 4 });
          if (!reduceMotion) { const q = R.emPath(p.kV, B, am(), ph0, h.T * ((tt * 0.4 + k / N) % 1)); sc.glow([q.x / Math.max(2 * h.r, 1e-12) * R3, q.y / Math.max(2 * h.r, 1e-12) * R3, 1.74 - 0.32 * q.z / Lm()], 5, [160, 225, 255], 1, { px: true, layer: 'front' }); }
        }
        sc.glow([0, 0, 1.42], 7, [200, 255, 220], 0.9, { px: true, layer: 'front' });
        for (const s of [-1, 1]) sc.line([0, 0, 1.42], [s * 0.2, 0, 1.13], 'rgba(130,210,255,0.5)', 1.2, { layer: 'front' });
        sc.circle([0, 0, 1.125], [0, 0, 1], 0.2, 'rgba(90,255,150,0.9)', 2.2, { glow: 'rgba(90,255,150,0.8)', layer: 'front' });
        sc.glow([0, 0, 1.13], 0.25, [80, 255, 140], 0.35);
      }
      // the desk and the two screens
      sc.box([-1.25, 0.4, 0.38], [0.6, 0.35, 0.02], { rgb: [120, 96, 70], amb: 0.6 });
      for (const [x, y] of [[-1.75, 0.1], [-0.75, 0.1], [-1.75, 0.7], [-0.75, 0.7]]) sc.box([x, y, 0.19], [0.02, 0.02, 0.19], { rgb: [60, 64, 68], amb: 0.6 });
      sc.box([-1.25, 0.6, 0.62], [0.36, 0.03, 0.22], { rgb: [24, 26, 28], amb: 0.6 });
      sc.custom([-1.25, 0.565, 0.62], (g, x, y, k) => { const w = 0.66 * k, hh = 0.4 * k, S2 = Math.min(w, hh) * 0.95, src = imgCv && dTot() * 1e9 / p.fov * 360 / 2.3548 >= 0.6 ? imgCv : specCanvas(360, light); g.fillStyle = '#000'; g.fillRect(x - w / 2, y - hh / 2, w, hh); if (on || light) { g.globalAlpha = light ? 1 : clamp(t / TRUN, 0.2, 1); g.drawImage(src, x - S2 / 2, y - S2 / 2, S2, S2); g.globalAlpha = 1; } });
      // the light microscope on a side table
      const lx = 1.35, ly = -0.6, hi = light ? 1 : 0.55;
      sc.box([lx, ly, 0.38], [0.35, 0.3, 0.02], { rgb: [120, 96, 70], amb: 0.6 });
      for (const [dx, dy] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]]) sc.box([lx + dx, ly + dy, 0.19], [0.02, 0.02, 0.19], { rgb: [60, 64, 68], amb: 0.6 });
      sc.box([lx, ly + 0.05, 0.42], [0.1, 0.12, 0.02], { rgb: [40, 44, 48].map(v => v * (0.6 + 0.4 * hi)), amb: 0.6 });
      sc.box([lx, ly + 0.14, 0.58], [0.025, 0.03, 0.16], { rgb: [44, 48, 52], amb: 0.6 });
      sc.box([lx, ly + 0.02, 0.52], [0.07, 0.06, 0.008], { rgb: [70, 74, 78], amb: 0.6 });
      sc.cyl([lx, ly + 0.06, 0.6], [lx, ly + 0.02, 0.78], 0.025, { rgb: [220, 224, 228], amb: 0.6 }, 12);
      if (light) sc.glow([lx, ly + 0.02, 0.47], 0.08, [255, 240, 200], 0.6);
      sc.label([0, 0, 2.85], 'transmission electron microscope', { color: '#e6ece8' });
      sc.label([0.36, 0, 1.36], light ? 'objective lens' : `magnetic lens: ${pl(Bnow(), 3)} T`, { color: '#c8c0ff', align: 'left' });
      if (on) sc.label([0.36, 0, 1.6], 'electrons spiral (drawn wider)', { color: '#9fd8ff', align: 'left' });
      sc.label([lx, ly, 0.95], 'light microscope', { color: light ? '#ffd590' : 'rgba(214,224,218,0.7)' });
      sc.end();
    }

    const SPECS = Object.entries(SPEC);
    const sim = {
      go: 'Switch on the beam', speeds: [['1', 'normal']], speed0: '1',
      canvasLabel: 'An electron microscope: electrons from a gun are sped up, pass through a specimen and are focused by a magnetic lens in which each electron spirals and comes back to the axis; the screen shows the specimen, here a coronavirus. A light microscope can be chosen instead',
      graphs: ['Finest detail against the voltage', 'Field the lens needs against the voltage'],
      side() {
        return `<div class="panel"><div class="panel-title">Look at</div><div class="chips chips-cards" id="rs-em-spec">${SPECS.map(([k, S]) => `<button type="button" class="chip-btn" data-spec="${k}">${S.t}<small>${S.sub}</small></button>`).join('')}</div><p class="hint" id="rsEmSpecNote"></p></div>
          <div class="panel"><div class="panel-title">Microscope</div>${segHTML('em-mode', 'Microscope', [['light', 'Light', 'glass lenses'], ['em', 'Electrons', 'magnetic lens']])}</div>
          <details class="acc tag-copper" open><summary><span class="acc-title">Electrons and lens</span></summary><div class="acc-body">
            ${ctl('em-kV', 'Accelerating voltage', 'kV')}<p class="hint" id="rsEmKvNote"></p>
            ${ctl('em-trim', 'Focus (lens field trim)', '‰')}<p class="hint" id="rsEmFocNote"></p>
            <div data-level="expert">${ctl('em-L', 'Lens: focus distance', 'mm')}${ctl('em-a', 'Aperture angle', 'mrad')}</div></div></details>
          <details class="acc tag-hazard" open><summary><span class="acc-title">The picture</span></summary><div class="acc-body">${ctl('em-fov', 'Field of view', 'nm')}<p class="hint" data-level="beginner">Zoom in on the virus with light, then with electrons.</p></div></details>`;
      },
      bind(changed) {
        const sync = () => { for (const b of $$('#rs-em-spec button')) b.classList.toggle('is-on', b.dataset.spec === p.spec); };
        this._sync = sync;
        $('#rs-em-spec').addEventListener('click', ev => { const b = ev.target.closest('[data-spec]'); if (!b) return; p.spec = b.dataset.spec; p.fov = SPEC[p.spec].fov; ctls.fov.sync(); sync(); changed(); });
        ctls.mode = segInit($('#rs-em-mode'), () => p.mode, v => { p.mode = v; changed(); });
        ctls.kV = range('em-kV', { min: 10, max: 300, step: 10, int: true, get: () => p.kV, set: v => { p.kV = v; changed(); } });
        ctls.trim = range('em-trim', { min: -3, max: 3, step: 0.01, get: () => p.trim, set: v => { p.trim = v; changed(); } });
        ctls.L = range('em-L', { min: 2, max: 20, step: 0.1, get: () => p.L, set: v => { p.L = v; changed(); } });
        ctls.a = range('em-a', { min: 1, max: 20, step: 0.5, get: () => p.a, set: v => { p.a = v; changed(); } });
        ctls.fov = range('em-fov', { min: 30, max: 30000, log: true, get: () => p.fov, set: v => { p.fov = v; changed(); } });
        sync();
      },
      reset() {
        reset(); if (this._sync) this._sync();
        const e = el(), n1 = $('#rsEmSpecNote'); if (n1) n1.innerHTML = SPEC[p.spec].note;
        const n2 = $('#rsEmKvNote'); if (n2) n2.innerHTML = p.mode === 'light' ? 'Not used by the light microscope.' : `Electrons reach <b>${pl(e.beta, 3)} c</b>; as waves they are <b>${pl(e.lambda * 1e12, 3)} pm</b> long, λ = h/p, about ${round2(550e-9 / e.lambda)} times shorter than green light.`;
        const n3 = $('#rsEmFocNote'); if (n3) n3.innerHTML = p.mode === 'light' ? '' : tooStrong() ? `This lens would need <b>${pl(Bfocus() * (1 + p.trim / 1000), 3)} T</b>, more than an iron pole piece can give (about ${E.Bmax} T): lower the voltage or make the lens longer.` : `B = <b>${pl(Bnow(), 4)} T</b>. At exactly ${pl(Bfocus(), 4)} T every electron is back on the axis after one turn${Math.abs(p.trim) < 0.005 ? ': in focus' : `; ${p.trim > 0 ? 'too strong' : 'too weak'}, the picture blurs by ${fmtL(dBlur())}`}.`;
      },
      step,
      draw(c, W, H, dtr, running) { draw2d(c, W, H, dtr, running); },
      home3d: { yaw: -2.1, pitch: 0.2, dist: 5.4, target: [-0.2, 0, 1.25], fov: 46, minDist: 0.6, maxDist: 14, minPitch: 0.02 },
      draw3d,
      clock: () => (p.mode === 'light' ? 'light microscope' : t <= 0 ? 'beam off' : t < TRUN ? `exposing · ${Math.round(100 * t / TRUN)} %` : 'picture taken'),
      speedApplies: () => false,
      status() {
        if (p.mode === 'light') return [`Light microscope · finest detail ${fmtL(dRes())}`, ''];
        if (tooStrong()) return [`The lens cannot reach ${pl(Bfocus(), 3)} T`, 'is-bad'];
        if (t <= 0) return [`${p.kV} kV electrons · λ = ${pl(el().lambda * 1e12, 3)} pm`, ''];
        if (!done) return ['Beam on · the picture builds up', 'is-run'];
        return dBlur() > dRes() * 0.3 ? [`Out of focus by ${fmtL(dBlur())}`, 'is-bad'] : [`In focus · finest detail ${fmtL(dRes())}`, 'is-good'];
      },
      narrate() {
        const sm = simple(), e = el(), h = R.emHelix(p.kV, Bnow(), am()), vir = p.spec === 'virus';
        if (p.mode === 'light') return sm ? `Light waves are about 550 nm long, and even the best glass lens blurs everything smaller than about <b>${fmtL(dRes())}</b>. ${vir ? 'The coronavirus is only about 100 nm across: you see a blur at best, never its spikes.' : p.spec === 'bacterium' ? 'You can see the bacterium, but its flagella (20 nm thick) are invisible.' : 'A red blood cell is easy to see: it is 40 times bigger than the blur.'} Switch to <b>Electrons</b>.` : `Abbe: d = λ/(2·NA) = 550 nm / (2 × 1.4) = ${fmtL(dRes())}. No glass lens can beat this, because it is set by the wavelength. ${vir ? 'A 100 nm virion is smaller than the blur, so it cannot be resolved; its 10 nm spikes are 20 times too small.' : ''}`;
        if (tooStrong()) return sm ? `Faster electrons are harder to bend: at ${p.kV} kV this lens would need ${pl(Bfocus(), 3)} T, but iron cannot give much more than ${E.Bmax} T. Lower the voltage, or (Intermediate) make the lens longer.` : `B = 2πp/(eL) = ${pl(Bfocus(), 3)} T at ${p.kV} kV and L = ${p.L} mm: above the ~${E.Bmax} T at which iron pole pieces saturate. Lengthen L (B ∝ 1/L) or lower V.`;
        if (sm) {
          if (t <= 0) return `Glass cannot bend electrons, but a magnet can. In the lens’s field each electron goes round in a circle while it moves down, a spiral, just like the electrons of the aurora round Earth’s field lines. Press <b>Switch on the beam</b>.`;
          if (!done) return `Each electron circles once (seen along the beam, top left) and comes back to the middle after the same time, however fast it moved sideways: so they all meet again in one point. That is the focus, ${p.L} mm below the specimen.`;
          return dBlur() > dRes() * 0.3 ? `Out of focus: the field is ${p.trim > 0 ? 'a little too strong' : 'a little too weak'}, so the electrons meet above or below the screen. Move the focus to 0.` : `${vir ? 'Every spike of the virus is sharp.' : 'Sharp.'} The electrons are waves only ${pl(e.lambda * 1e12, 3)} pm long, so this microscope can show details down to ${fmtL(dRes())}, about ${Math.round(R.emLight() / dRes())} times finer than light.`;
        }
        if (t <= 0) return `Electrons at ${p.kV} kV: γ = ${pl(e.gam, 4)}, p = ${pl(e.p * R.C.c / R.C.e / 1e3, 4)} keV/c, λ = h/p = ${pl(e.lambda * 1e12, 4)} pm. In a uniform axial field B an electron leaving the axis at angle a circles with r = p sin a/(eB) = ${fmtL(h.r)} and period T = 2πγm/(eB) = ${pl(h.T * 1e12, 3)} ps, while moving along at v cos a.`;
        if (!done) return `The period does not depend on the transverse speed, so every electron returns to the axis at L = v cos a·T = ${p.L} mm: a focus, as in Busch’s magnetic lens. Wide-angle electrons arrive slightly early (cos a), which is this lens’s spherical aberration, Cs = L/2.`;
        return `Point resolution (Scherzer): d = 0.66 Cs^¼ λ^¾ = 0.66 × (${pl(R.emCs(Lm()) * 1e3, 3)} mm)^¼ × (${pl(e.lambda * 1e12, 3)} pm)^¾ = ${fmtL(dRes())}${dBlur() > 5e-13 ? `; defocus adds a blur disc of ${fmtL(dBlur())}` : ''}. Real objective lenses squeeze the field into a gap a few mm long and reach Cs ≈ 1 mm.`;
      },
      tiles() {
        const e = el(), h = R.emHelix(p.kV, Bnow(), am()), light = p.mode === 'light';
        return [
          [light ? 'Light wavelength' : 'Electron wavelength', light ? '550 nm' : `${pl(e.lambda * 1e12, 3)} pm`, light ? 'green light' : `λ = h/p at ${p.kV} kV`],
          ['Lens', light ? 'glass' : `${pl(Bnow(), 3)} T`, light ? 'bends light by refraction' : 'a magnetic field along the beam'],
          ['Spiral in the lens', light ? '–' : `r = ${fmtL(h.r)}`, light ? 'light does not spiral' : `one turn in ${p.L} mm (${pl(h.T * 1e12, 3)} ps)`],
          ['Finest detail', fmtL(dRes()), light ? 'λ/(2·NA): a coronavirus is about 100 nm' : `about ${Math.round(R.emLight() / dRes())}× finer than light`],
        ];
      },
      graphA(cv) {
        const a = [], b = [];
        for (let kv = 20; kv <= 300; kv += 5) { a.push([kv, R.emScherzer(kv, R.emCs(Lm())) * 1e9]); b.push([kv, R.emScherzer(kv, 1.2e-3) * 1e9]); }
        const r = plot(cv, { xmin: 20, xmax: 300, ymin: 0, ymax: 1.2, xlabel: 'accelerating voltage (kV)', ylabel: 'finest detail (nm)', pad: { r: 16 },
          series: [{ pts: b, color: 'rgba(214,224,218,0.5)', width: 1.5, dash: [4, 4] }, { pts: a, color: '#9fd8ff', width: 2.2 }] });
        if (!r) return;
        const c = r.ctx, x = r.XP(p.kV), y = r.YP(R.emScherzer(p.kV, R.emCs(Lm())) * 1e9); glow(c, x, y, 9, '159,216,255', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
        c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillStyle = 'rgba(214,224,218,0.8)';
        c.fillText(`this lens (Cs = ${pl(R.emCs(Lm()) * 1e3, 2)} mm) · dashed: a real objective (Cs = 1.2 mm) · light: 196 nm, far off the top`, r.W - r.pad.r - 4, r.pad.t + 2);
      },
      graphB(cv) {
        const pts = []; for (let kv = 10; kv <= 300; kv += 5) pts.push([kv, R.emFocusB(kv, Lm())]);
        const r = plot(cv, { xmin: 10, xmax: 300, ymin: 0, ymax: Math.max(3, ...pts.map(q => q[1])) * 1.05, xlabel: 'accelerating voltage (kV)', ylabel: 'lens field B (T)', pad: { r: 16 },
          series: [{ pts: [[10, E.Bmax], [300, E.Bmax]], color: 'rgba(255,150,120,0.7)', dash: [5, 5], width: 1.5 }, { pts, color: '#c8c0ff', width: 2.2 }] });
        if (!r) return;
        const c = r.ctx, x = r.XP(p.kV), y = r.YP(Bfocus()); glow(c, x, y, 9, '200,192,255', 0.9); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
        c.font = '600 10.5px "Barlow", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillStyle = 'rgba(255,170,140,0.95)'; c.fillText(`iron saturates: about ${E.Bmax} T`, r.pad.l + 6, r.YP(E.Bmax) - 2);
        c.fillStyle = 'rgba(214,224,218,0.8)'; c.textBaseline = 'top'; c.fillText(`B = 2πp/(eL), L = ${p.L} mm: faster electrons need more field`, r.pad.l + 6, r.pad.t + 2);
      },
      numbers() {
        const e = el(), B = Bnow(), h = R.emHelix(p.kV, B, am()), mc2 = 510.999;
        let hh = sec('The electrons');
        hh += row('Speed', `${pl(e.beta, 4)} c`, `Accelerated through ${p.kV} kV: kinetic energy ${p.kV} keV, rest energy ${pl(mc2, 4)} keV.`, `γ = 1 + eV/mc² = 1 + ${p.kV}/${pl(mc2, 4)} = ${pl(e.gam, 5)}; v = c√(1 − 1/γ²)`);
        hh += row('Momentum', `${pl(e.p * R.C.c / R.C.e / 1e3, 4)} keV/c`, '', `pc = √(K² + 2K·mc²) = √(${p.kV}² + 2 × ${p.kV} × ${pl(mc2, 4)}) keV`);
        hh += row('Wavelength', `${pl(e.lambda * 1e12, 4)} pm`, 'de Broglie: every moving particle is also a wave.', `λ = h/p = 6.626 × 10⁻³⁴ J s / ${CL.e(e.p, 4)} kg m/s`);
        hh += row('Light, for comparison', `${fmtL(R.emLight())}`, 'Green light with the best oil-immersion objective.', 'd = λ/(2·NA) = 550 nm / (2 × 1.4)');
        hh += sec('The magnetic lens');
        hh += row('Field for a focus', `${pl(Bfocus(), 4)} T`, `A long coil with a uniform field along the axis. ${tooStrong() ? `<b>Too much for iron (about ${E.Bmax} T).</b>` : `Below the ~${E.Bmax} T an iron pole piece can give.`}`, `B = 2πp/(eL) = 2π × ${CL.e(e.p, 4)} kg m/s / (1.602 × 10⁻¹⁹ C × ${p.L} × 10⁻³ m)`);
        hh += row('Circle', `r = ${fmtL(h.r)}`, `For an electron leaving the axis at ${p.a} mrad.`, `r = p sin a/(eB) = ${CL.e(e.p, 4)} × sin(${p.a} mrad) / (1.602 × 10⁻¹⁹ × ${pl(B, 4)})`);
        hh += row('One turn', `${pl(h.T * 1e12, 4)} ps`, 'The same for every electron, whatever its sideways speed: so they all meet again.', `T = 2πγm/(eB) = 2π × ${pl(e.gam, 4)} × 9.109 × 10⁻³¹ kg / (1.602 × 10⁻¹⁹ C × ${pl(B, 4)} T)`);
        hh += row('Where they meet', `${pl(h.pitch * 1e3, 4)} mm on`, '', `L = v cos a · T = ${pl(e.v, 4)} m/s × cos(${p.a} mrad) × ${pl(h.T * 1e12, 4)} ps`);
        hh += sec('How fine a detail');
        hh += row('Spherical aberration', `Cs = ${pl(R.emCs(Lm()) * 1e3, 3)} mm`, 'Electrons at a wider angle move along the axis a little slower (cos a) and meet a little early: for this lens Cs = L/2.', '');
        hh += row('Finest detail', fmtL(R.emScherzer(p.kV, R.emCs(Lm()))), `Scherzer’s point resolution. ${p.mode === 'light' ? '' : `${Math.round(R.emLight() / R.emScherzer(p.kV, R.emCs(Lm())))}× finer than light.`}`, `d = 0.66 Cs^¼ λ^¾`);
        if (dBlur() > 5e-13) hh += row('Out of focus', fmtL(dBlur()), 'With the field trimmed away from the focus value the electrons meet above or below the screen and arrive as a disc.', '');
        return hh;
      },
      check() {
        const l = kv => R.emElectron(kv).lambda * 1e12, e2 = R.emElectron(200);
        const rows = [
          ['Wavelength at 100 kV', `${pl(l(100), 4)} pm`, '3.70 pm', 'utah', Math.abs(l(100) - 3.70) < 0.02 ? 'good' : 'warn'],
          ['Wavelength at 200 kV', `${pl(l(200), 4)} pm`, '2.51 pm', 'utah', Math.abs(l(200) - 2.51) < 0.02 ? 'good' : 'warn'],
          ['Wavelength at 300 kV', `${pl(l(300), 4)} pm`, '1.96 pm', 'utah', Math.abs(l(300) - 1.96) < 0.02 ? 'good' : 'warn'],
          ['Speed at 200 kV', `${pl(e2.beta, 4)} c`, '0.6953 c', 'tem672e', Math.abs(e2.beta - 0.6953) < 1e-3 ? 'good' : 'warn'],
          ['Scherzer, 200 kV, Cs = 1.2 mm', `${pl(R.emScherzer(200, 1.2e-3) * 1e10, 3)} Å`, '2.4 Å (Talos)', 'epflcs', 'good'],
          ['Scherzer, 300 kV, Cs = 1.2 mm', `${pl(R.emScherzer(300, 1.2e-3) * 1e10, 3)} Å`, '2.0 Å (Talos)', 'epflcs', 'good'],
          ['This lens at 200 kV (Cs = 2.5 mm)', `${pl(R.emScherzer(200, 2.5e-3) * 1e10, 3)} Å`, '2.4 Å with a real short lens', 'epflcs', 'warn'],
          ['Field for a 5 mm lens at 200 kV', `${pl(R.emFocusB(200, 5e-3), 3)} T`, 'pole pieces: up to about 2.1 T', 'tem672', R.emFocusB(200, 5e-3) <= E.Bmax ? 'good' : 'warn'],
          ['Best light microscope', `${pl(R.emLight() * 1e9, 3)} nm`, 'about 200 nm', 'utah', 'good'],
        ];
        return '<p class="hint">Green: within 20 % of the published value. Yellow: the long uniform lens used here is simpler and a little worse than a real objective lens, which squeezes the field into a short gap between iron pole pieces.</p>' + cmpTable(rows);
      },
      keyNumbers() {
        const e = el(), h = R.emHelix(p.kV, Bnow(), am());
        return row('Electron wavelength', `${pl(e.lambda * 1e12, 3)} pm`, `At ${p.kV} kV; green light: 550,000 pm.`)
          + row('Lens field', `${pl(Bnow(), 3)} T`, 'About 40,000 times Earth’s field.')
          + row('Spiral in the lens', `r = ${fmtL(h.r)}`, `Every electron goes round once in ${pl(h.T * 1e12, 3)} ps and meets the others ${p.L} mm on.`)
          + row('Finest detail', fmtL(R.emScherzer(p.kV, R.emCs(Lm()))), `Light: about ${fmtL(R.emLight())}.`)
          + row('A coronavirus', 'about 100 nm', 'With spikes 9 to 12 nm long.');
      },
      link(sm) {
        // the aurora's electron: 5 keV at 45° to the field, in 50 µT near the ground
        const ea = R.emElectron(5), Ba = 5e-5, ra = ea.p * Math.SQRT1_2 / (R.C.e * Ba), Ta = 2 * Math.PI * ea.gam * R.C.me / (R.C.e * Ba), pa = ea.v * Math.SQRT1_2 * Ta;
        const B = Bnow(), h = R.emHelix(p.kV, B, am());
        const rows = [
          ['Magnetic field', 'Earth’s, about 50 µT near the ground', `the lens’s, ${pl(B, 3)} T`],
          ['Circle, r = p⊥/(eB)', `${pl(ra, 3)} m (5 keV electron)`, `${fmtL(h.r)}`],
          ['One turn every', `${pl(pa, 3)} m along the field`, `${pl(h.pitch * 1e3, 3)} mm along the axis`],
        ];
        if (!sm) rows.push(['Period, T = 2πγm/(eB)', `${pl(Ta * 1e6, 3)} µs`, `${pl(h.T * 1e12, 3)} ps`], ['What it does', 'guides electrons down to the polar sky', 'brings every electron back to the axis: a focus']);
        return {
          title: 'How is an electron microscope like the aurora?',
          text: sm ? 'The aurora’s electrons and a microscope’s electrons follow the same rule: in a magnetic field they go round in circles while they slide along it, r = p⊥/(eB). Earth’s field is weak, so the circles are metres wide. A microscope’s lens is about 40,000 times stronger, so they are micrometres wide, and the lens is made so that after one turn every electron is back in the middle: they all meet in one point.'
            : `Same Lorentz force, F = −e v × B: the parallel velocity is untouched, the perpendicular part turns at ω = eB/γm. In the auroral zone that makes a circle of radius ${pl(ra, 2)} m; in a ${pl(B, 2)} T lens, of radius ${fmtL(h.r)}. Because ω does not depend on v⊥ (the same reason one RF frequency drives your cyclotron), all electrons from a point return to the axis together: a lens.`,
          cols: ['The aurora', 'An electron microscope'], rows, alt: 'Animation: on the left an electron spirals down a field line of the Earth; on the right electrons spiral in a magnetic lens and meet in one point',
          draw: (c, W, H, t2) => twoPanels(c, W, H, t2, (c2, w, h2, t3) => {
            const ex = w * 0.5, ey = h2 * 0.62, er = Math.min(w * 0.08, h2 * 0.15), Lp = Math.min(w * 0.42, h2 * 0.95);
            const pt = la => { const r = Lp * Math.cos(la) ** 2; return [ex + r * Math.cos(la), ey - r * Math.sin(la)]; };
            c2.strokeStyle = 'rgba(150,170,255,0.45)'; c2.lineWidth = 1.2; c2.beginPath(); for (let i = 0; i <= 50; i++) { const [x, y] = pt(-1.05 + 2.1 * i / 50); i ? c2.lineTo(x, y) : c2.moveTo(x, y); } c2.stroke();
            const eg = c2.createRadialGradient(ex - er * 0.4, ey - er * 0.4, 1, ex, ey, er); eg.addColorStop(0, '#3b7fc0'); eg.addColorStop(1, '#0c2742'); c2.fillStyle = eg; c2.beginPath(); c2.arc(ex, ey, er, 0, TAU); c2.fill();
            const T2 = 3.2, q = (t3 % T2) / T2, lam = q, toPt = l2 => { const [x2, y2] = pt(l2), [x3, y3] = pt(l2 + 1e-3), tl = Math.hypot(x3 - x2, y3 - y2) || 1; return [x2, y2, -(y3 - y2) / tl, (x3 - x2) / tl]; };
            c2.strokeStyle = 'rgba(120,210,255,0.55)'; c2.lineWidth = 1; c2.beginPath();
            for (let i = 0; i <= 60; i++) { const l2 = lam * i / 60, [x2, y2, nx, ny] = toPt(l2), w2 = Math.sin(t3 * 26 - (lam - l2) * 90) * 6 * (1 - 0.6 * l2); i ? c2.lineTo(x2 + nx * w2, y2 + ny * w2) : c2.moveTo(x2 + nx * w2, y2 + ny * w2); }
            c2.stroke();
            text(c2, 'the aurora', 10, 15, { size: 13 }); text(c2, `B ≈ 50 µT · r ≈ ${pl(ra, 2)} m`, 10, 33, { size: 12, color: '#9df5b8' });
            text(c2, 'circles while it slides along B', 10, h2 - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
          }, (c2, w, h2, t3) => {
            const cx = w * 0.58, y0 = h2 * 0.18, y1 = h2 * 0.82, half = Math.min(w * 0.07, 22);
            for (const s2 of [-1, 1]) { c2.fillStyle = '#b8692e'; rrect(c2, cx + (s2 < 0 ? -half - 18 : half), y0 + 8, 18, y1 - y0 - 16, 3); c2.fill(); }
            const N = 6, u = (t3 % 2.4) / 2.4;
            for (let k = 0; k < N; k++) { const ph0 = TAU * k / N; c2.strokeStyle = `hsla(${200 + 20 * Math.sin(ph0)},90%,65%,0.7)`; c2.lineWidth = 1.2; c2.beginPath(); for (let i = 0; i <= 40; i++) { const f = i / 40, x = cx + half * 0.8 * (Math.sin(ph0 + TAU * f) - Math.sin(ph0)) / 2, y = y0 + (y1 - y0) * f; i ? c2.lineTo(x, y) : c2.moveTo(x, y); } c2.stroke(); const x = cx + half * 0.8 * (Math.sin(ph0 + TAU * u) - Math.sin(ph0)) / 2; glow(c2, x, y0 + (y1 - y0) * u, 4, '150,220,255', 0.95); }
            glow(c2, cx, y1, 8, '200,255,220', 0.9);
            text(c2, 'a magnetic lens', 10, 15, { size: 13 }); text(c2, `B = ${pl(B, 3)} T · r = ${fmtL(h.r)}`, 10, 33, { size: 12, color: '#9df5b8' });
            text(c2, 'one turn, then all meet: a focus', 10, h2 - 11, { size: 11.5, color: 'rgba(214,224,218,0.75)' });
          }),
        };
      },
      sources: ['utah', 'tem672e', 'tem672', 'epflcs', 'ruska', 'zhu', 'ecoli', 'flag', 'rbc'],
      whySources: ['wrapp', 'almeida', 'emvir', 'kidney', 'cdsem', 'ruska'],
      get without() { return p.mode === 'light'; },
      setWithout(b) { p.mode = b ? 'light' : 'em'; if (ctls.mode) ctls.mode.sync(); },
      why(sm) {
        const e = el(), dE = R.emScherzer(p.kV, R.emCs(Lm())), dL = R.emLight();
        return {
          q: 'Why bend electrons with a magnet?',
          a: sm ? `To see things far too small for light. Light waves are about 550 nm long, so even the best light microscope blurs everything smaller than about 200 nm, and a coronavirus is only about 100 nm across. Electrons sped up by ${p.kV} kV behave like waves ${pl(e.lambda * 1e12, 3)} pm long. Glass cannot bend electrons, but a magnet can: in the lens each electron spirals, like the aurora’s electrons, and after one turn they all meet again in one point. A lens made of magnetism.`
            : `Resolution is set by the wavelength: about λ/(2·NA) = ${pl(dL * 1e9, 3)} nm for green light and the best glass. Electrons at ${p.kV} kV have λ = h/p = ${pl(e.lambda * 1e12, 3)} pm. A coil focuses them because the cyclotron period T = 2πγm/(eB) does not depend on the sideways speed: every electron is back on the axis after one turn. Lens aberrations, not λ, then limit the detail: Scherzer’s 0.66 Cs^¼ λ^¾ = ${pl(dE * 1e9, 3)} nm here.`,
          metric: 'Smallest detail it can show',
          mark: { v: 100, label: 'a coronavirus is about 100 nm across' },
          pick: true,
          rows: [
            { k: 'off', label: 'Light microscope (green light, best lens)', v: dL * 1e9, txt: `about ${Math.round(dL * 1e9)} nm: a blur`, cur: p.mode === 'light' },
            { k: 'on', label: 'Electron microscope (this setup)', v: dE * 1e9, txt: `${pl(dE * 1e9, 2)} nm: every spike`, cur: p.mode !== 'light' },
          ],
          verdict: 'That is why the first coronavirus was found with an electron microscope, in 1964, and why doctors in China photographed the virus behind COVID-19 with one in January 2020, weeks into the outbreak.',
        };
      },
      helps(sm) {
        return [
          ['syringe', 'Vaccines', 'In February 2020, weeks into the outbreak, a cryo-electron microscope showed the new virus’s spike protein to 0.35 nm. The spike is a key target for vaccines.', 'wrapp'],
          ['virus', 'A virus gets its name', 'In 1964 June Almeida saw a new virus ringed with spikes in her electron microscope; that crown, corona in Latin, named the coronaviruses.', 'almeida'],
          ['person', 'Patients with infections', 'Electron microscopes still find viruses in patient samples: they need no special test for each virus, they show whatever is there.', 'emvir'],
          ['scan', 'Kidney patients', 'Some kidney diseases need an electron microscope to be diagnosed correctly; without it the diagnosis can be wrong.', 'kidney'],
          ['chip', 'Phones and computers', 'Chip factories check their patterns with electron microscopes, “the ruler of the fab”, measuring to below a nanometre.', 'cdsem'],
          ['star', 'A Nobel Prize', 'Ernst Ruska found that a magnetic coil can act as a lens for electrons, and in 1933 built the first electron microscope that beat the light microscope (Nobel Prize in Physics, 1986).', 'ruska'],
        ];
      },
    };
    return sim;
  }

  function makeAuroraBoth() {
    const v1 = makeAurora(), v2 = makeSolarWind();
    let ver = 'one';
    const pick = () => (ver === 'sun' ? v2 : v1);
    const verHTML = () => `<div class="panel au-ver"><div class="panel-title">Which version?</div>${segHTML('au-ver', 'Version of the aurora simulation', [['one', '1 · One particle', 'up close, spiral by spiral'], ['sun', '2 · From the Sun', 'realistic: the whole solar wind']])}</div>`;
    return new Proxy({}, {
      get(_, k) {
        const s = pick();
        if (k === 'side') return () => verHTML() + s.side();
        if (k === 'bind') return changed => { segInit($('#rs-au-ver'), () => ver, v => { if (v === ver) return; ver = v; CL.realsim.reselect(); }); s.bind(changed); };
        if (k === 'version') return ver;
        if (k === 'why') return sm => { const Y = v2.why(sm); if (ver !== 'sun') for (const r of Y.rows) r.cur = r.k === 'on'; return Y; };
        if (k === 'helps') return sm => v2.helps(sm);
        if (k === 'whySources') return v2.whySources;
        if (k === 'without') return ver === 'sun' && v2.without;
        if (k === 'setWithout') return b => { v2.setWithout(b); if (b && ver !== 'sun') { ver = 'sun'; CL.realsim.reselect(); } };
        const val = s[k];
        return typeof val === 'function' ? val.bind(s) : val;
      },
      set(_, k, v) { if (k === 'version') { ver = v; return true; } pick()[k] = v; return true; },
      has(_, k) { return k in pick(); },
    });
  }

  const MAKE = { maglev: makeMaglev, catapult: makeCatapult, pet: makePET, petscan: makePETScan, aurora: makeAuroraBoth, tem: makeTEM, lhc: makeLHC };

  /* =====================================================================
     The frame round the simulations: header, picker, run controls,
     tiles, graphs, notebook; and the doors into it from the stations
     ===================================================================== */
  let root = null, host = null, cur = null, sim = null, runState = 'idle', speedKey = '1', dataTab = 'numbers', working = true;
  let cv = null, ctx = null, W = 0, H = 0, lastUI = 0, lastGraph = 0, lastData = 0, graphDirty = true, dataDirty = true, opener = null;
  let linkCv = null, linkCtx = null, LW = 0, LH = 0, linkT = 0, linkDraw = null, linkSeen = true, v3 = null;
  const sims = {};

  function shellHTML() {
    return `<div class="rsim-head">
        <button type="button" class="pbtn rsim-back" id="rsBack"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 4.4 7.8 12l7.6 7.6-1.8 1.8L4.2 12l9.4-9.4z"/></svg><span>Back to the <b id="rsHost">Gauss gun</b></span></button>
        <div class="rsim-titles"><p class="rsim-kicker">Real life, simulated</p><h2 class="rsim-title" id="rsTitle" tabindex="-1"></h2></div>
        <div class="rsim-picks" role="tablist" aria-label="Choose what to simulate">${ORDER.map(id => `<button type="button" role="tab" class="rsim-pick" id="rsTab-${id}" data-sim="${id}" aria-selected="false" aria-controls="rsBody">${ICON[id]}<span>${SIM[id].name}<small>${SIM[id].tag}</small></span></button>`).join('')}</div>
      </div>
      <section class="paper rsim-why" id="rsWhy" aria-labelledby="rsWhyQ">
        <div class="why-text"><h3 class="why-q" id="rsWhyQ"></h3><p class="why-a" id="rsWhyA"></p></div>
        <div class="why-cmp" id="rsWhyCmp"></div>
        <button type="button" class="why-fold" id="rsWhyFold" aria-expanded="true" aria-label="Hide the answer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 15.4 12 9.8l5.6 5.6 1.4-1.4-7-7-7 7z"/></svg></button>
      </section>
      <div class="arena-layout rsim-layout" id="rsBody" role="tabpanel">
        <div class="arena-main">
          <div class="arena-wrap rsim-wrap" id="rsWrap"><canvas id="rsCanvas" role="img"></canvas><div class="hud hud-status" id="rsStatus" aria-live="polite">Ready</div></div>
          <div class="arena-bar">
            <button type="button" class="btn-go" id="rsGo">Start</button>
            <button type="button" class="pbtn" id="rsReset">Reset</button>
            <div class="speeds" role="radiogroup" aria-label="Playback speed" id="rsSpeeds" data-level="expert"></div>
            <span class="arena-time" id="rsClock">t = 0 s</span>
          </div>
          <div class="narrate rsim-narrate"><div class="narrate-t">What is happening</div><p class="narrate-x" id="rsNarrate" aria-live="polite"></p></div>
          <div class="tiles" id="rsTiles"></div>
          <section class="card paper rsim-helps" id="rsHelps" aria-labelledby="rsHelpsT">
            <h3 class="rsim-helps-t" id="rsHelpsT">Who it helps</h3>
            <ul class="rsim-helps-l" id="rsHelpsL"></ul>
          </section>
          <section class="card paper rsim-link" id="rsLink" aria-labelledby="rsLinkT">
            <h3 class="rsim-link-t" id="rsLinkT"></h3>
            <p class="rsim-link-x" id="rsLinkX"></p>
            <div class="rsim-link-body"><canvas class="rsim-link-cv" id="rsLinkCv" role="img"></canvas><div class="rsim-link-tab table-wrap" id="rsLinkTab"></div></div>
          </section>
          <div class="card gg-graphs">
            <div class="gg-graph"><div class="graph-head"><span class="panel-title" id="rsGAt"></span></div><canvas id="rsGA" role="img"></canvas></div>
            <div class="gg-graph" data-level="expert"><div class="graph-head"><span class="panel-title" id="rsGBt"></span></div><canvas id="rsGB" role="img"></canvas></div>
          </div>
          <div class="card data" id="rsData">
            <div class="data-head">
              <div class="tabs" role="tablist" aria-label="Numbers behind the simulation">
                <button type="button" role="tab" data-tab="numbers" id="rsNumTab">The numbers</button>
                <button type="button" role="tab" data-tab="check">Real-world check</button>
                <button type="button" role="tab" data-tab="sources">Sources</button>
              </div>
              <label class="switch switch-sm" data-level="expert"><input type="checkbox" id="rsWorking" checked><span class="switch-track" aria-hidden="true"></span><span class="switch-text">Show working</span></label>
            </div>
            <div class="data-body" id="rsDataBody" role="tabpanel"></div>
          </div>
        </div>
        <aside class="side" id="rsSide" aria-label="Settings for this simulation"></aside>
      </div>`;
  }
  function entryHTML(hostName) {
    return `<div class="panel rsim-entry"><div class="panel-title">Real life, simulated</div>
      ${HOSTS[hostName].map(id => `<button type="button" class="rsim-card" data-open-sim="${id}"><span class="rsim-card-ico" aria-hidden="true">${ICON[id]}</span><span class="rsim-card-t">${SIM[id].name}</span><span class="rsim-card-s">${SIM[id].why}</span></button>`).join('')}</div>`;
  }

  function open(id, hostName) {
    if (!root) return;
    hostName = hostName || (HOSTS[CL.active] && HOSTS[CL.active].includes(id) ? CL.active : SIM[id].host);
    opener = document.activeElement;
    if (CL.active !== hostName) CL.go(hostName);
    const scr = $('#screen-' + hostName);
    if (host && host !== hostName) { const old = $('#screen-' + host); if (old) old.classList.remove('has-rsim'); }
    if (root.parentNode !== scr) scr.appendChild(root);
    host = hostName; scr.classList.add('has-rsim'); root.hidden = false; scr.scrollTop = 0;
    if (getComputedStyle(scr).position !== 'absolute') window.scrollTo(0, 0);     // narrow screens scroll the page, not the station
    if (CL.screens[host] && CL.screens[host].hide) CL.screens[host].hide();
    $('#rsHost').textContent = HOST_NAME[host];
    select(id, true);
    requestAnimationFrame(() => { resize(); $('#rsTitle').focus({ preventScroll: true }); });
  }
  function close() {
    if (!host) return;
    const h = host, scr = $('#screen-' + h);
    setRun(runState === 'run' ? 'pause' : runState);
    if (scr) scr.classList.remove('has-rsim');
    root.hidden = true; host = null;
    if (CL.active === h && CL.screens[h] && CL.screens[h].show) CL.screens[h].show();
    const back = (scr && scr.querySelector(`[data-open-sim="${cur}"]`)) || opener;
    if (back && back.focus && back.isConnected) back.focus({ preventScroll: true });
    if (CL.reallife) CL.reallife.kick();
  }
  function select(id, fresh) {
    if (sim && runState === 'run') setRun('pause');
    cur = id; sim = sims[id] || (sims[id] = MAKE[id]());
    for (const b of $$('.rsim-pick', root)) b.setAttribute('aria-selected', String(b.dataset.sim === id));
    $('#rsTitle').textContent = SIM[id].name;
    cv.setAttribute('aria-label', sim.canvasLabel);
    $('#rsGAt').textContent = sim.graphs[0]; $('#rsGBt').textContent = sim.graphs[1];
    $('#rsGA').setAttribute('aria-label', sim.graphs[0]); $('#rsGB').setAttribute('aria-label', sim.graphs[1]);
    $('#rsSide').innerHTML = sim.side();
    sim.bind(changed);
    if (v3) { v3.scene.setHome(Object.assign({ yaw: -0.9, pitch: 0.45, dist: 4, target: [0, 0, 0], fov: 46, minDist: 0.05, maxDist: 100 }, sim.home3d || {})); v3.scene.reset(); if (v3.syncZoomKey) v3.syncZoomKey(); }
    if (!sim._speed) sim._speed = sim.speed0;
    renderSpeeds();
    sim.reset();
    setRun('idle');
    $('#rsTiles').innerHTML = '';
    graphDirty = dataDirty = true; W = 0;
    renderLink(); linkT = 0; renderWhy(); renderHelps();
    if (!fresh) requestAnimationFrame(resize);
    updateUI(true);
  }
  // Why it exists: the problem it solves, the world without it and with it (both worked out by the same model), and who it helps
  let whyOpen = true;
  function renderWhy() {
    const box = $('#rsWhy');
    let Y = null;
    try { Y = sim && sim.why ? sim.why(simple()) : null; } catch (err) { console.error(err); }
    if (!Y) { box.hidden = true; return; }
    box.hidden = false;
    setText($('#rsWhyQ'), Y.q);
    const a = $('#rsWhyA'); if (a._h !== Y.a) { a._h = Y.a; a.innerHTML = Y.a; }
    const pick = !!Y.pick, max = Math.max(...Y.rows.map(r => r.v), Y.mark ? Y.mark.v : 0) * 1.08 || 1;
    const pc = v => `${clamp(100 * v / max, 0, 100).toFixed(1)}%`;
    const rowHTML = r => {
      const inner = `<span class="why-row-l">${r.label}</span><span class="why-track"><i style="width:${pc(r.v)}"></i>${Y.mark ? `<b class="why-tick" style="left:${pc(Y.mark.v)}"></b>` : ''}</span><span class="why-row-v">${r.txt}</span>`;
      const cls = `why-row ${r.k === 'off' ? 'is-off' : 'is-on'}${r.cur ? ' is-cur' : ''}`;
      return pick ? `<button type="button" class="${cls}" role="radio" aria-checked="${r.cur ? 'true' : 'false'}" data-why="${r.k}">${inner}</button>` : `<div class="${cls}" role="listitem">${inner}</div>`;
    };
    const html = `<p class="why-m">${Y.metric}${Y.mark ? ` <span class="why-mk"><i aria-hidden="true"></i>${Y.mark.label}</span>` : ''}</p>
      <div class="why-rows" role="${pick ? 'radiogroup' : 'list'}" aria-label="${esc(Y.metric)}">${Y.rows.map(rowHTML).join('')}</div>
      <p class="why-v">${Y.verdict}${pick ? ' <span class="why-hint">Pick a row to see that world in the simulation.</span>' : ''}</p>`;
    const cmp = $('#rsWhyCmp'); if (cmp._h !== html) { cmp._h = html; cmp.innerHTML = html; }
    box.classList.toggle('is-folded', !whyOpen);
    const f = $('#rsWhyFold'); f.setAttribute('aria-expanded', String(whyOpen)); f.setAttribute('aria-label', whyOpen ? 'Hide the answer' : 'Show the answer');
  }
  // Who it helps: the people who gain from it, with where each fact comes from
  const HICON = {
    person: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z',
    people: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm8 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM8 13c-3.3 0-6 1.8-6 4v2h12v-2c0-2.2-2.7-4-6-4zm8 0c-.5 0-1 0-1.5.1 1.5.9 2.5 2.3 2.5 3.9v2h5v-2c0-2.2-2.7-4-6-4z',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v6.2l5 3 1-1.7-4-2.4V7z',
    chart: 'M3 20h18v2H3zm2-3h3V9H5zm5.5 0h3V4h-3zm5.5 0h3v-6h-3z',
    scan: 'M10 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 3.6a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8zM3 12.2h20v1.9H3z',
    shield: 'M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
    sat: 'M2 6.2 6.2 2l5 5L7 11.2zM12.8 17l4.2-4.2 5 5-4.2 4.2zM8.8 12.4l3.6-3.6 2.8 2.8-3.6 3.6z',
    web: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15 15 0 0 0-1.3-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16 16 0 0 0 0 4zm.8 2h3a15 15 0 0 0 1.3 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.3-3.6A15 15 0 0 0 8.1 8zM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4zm.3 5.6c.6-1.1 1-2.3 1.3-3.6h3a8 8 0 0 1-4.3 3.6zm1.7-5.6a16 16 0 0 0 0-4h3.4a8 8 0 0 1 0 4z',
    beam: 'M14 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM1 11h9v2H1z',
    magnet: 'M5 3h5v8.5a2 2 0 0 0 4 0V3h5v8.5a7 7 0 0 1-14 0zm0 0v3h5V3zm9 0v3h5V3z',
    jet: 'M2 12.6 8.6 12l2.9-6.4h2.2l-1.5 6.2 4.9-.4L19.6 8h1.6l-.9 3.8 1.7.4v1.6l-1.7.4.9 3.8h-1.6l-2.5-3.4-4.9-.4 1.5 6.2h-2.2L8.6 14 2 13.4z',
    drone: 'M5 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm14 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM5 16.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm14 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 5.1l12.4 12.4-1.4 1.4L5.1 6.5zm11 0 1.4 1.4L6.5 18.9l-1.4-1.4zM9.5 9.5h5v5h-5z',
    wrench: 'M21 7.5a5 5 0 0 1-6.6 4.7L6.7 20a2 2 0 0 1-2.8-2.8l7.8-7.7A5 5 0 0 1 16.5 3l-3 3 .9 2.6 2.6.9z',
    planet: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-3 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
    star: 'M12 2l2.4 7.2H22l-6.1 4.6 2.3 7.2L12 16.5 5.8 21l2.3-7.2L2 9.2h7.6z',
    track: 'M2 15h20v2H2zm2-5h16v3H4zm3-4h10v3H7z',
    virus: (() => { let d = 'M12 6.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8z'; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a), px = -s * 0.6, py = c * 0.6, x0 = 12 + c * 5, y0 = 12 + s * 5, x1 = 12 + c * 7.6, y1 = 12 + s * 7.6, kx = 12 + c * 8.8, ky = 12 + s * 8.8, f = v => v.toFixed(2); d += `M${f(x0 + px)} ${f(y0 + py)}L${f(x1 + px)} ${f(y1 + py)}L${f(x1 - px)} ${f(y1 - py)}L${f(x0 - px)} ${f(y0 - py)}zM${f(kx + 1.5)} ${f(ky)}a1.5 1.5 0 1 0-3 0 1.5 1.5 0 1 0 3 0z`; } return d; })(),
    chip: 'M7 7h10v10H7zM9 2.5h2V6H9zm4 0h2V6h-2zM9 18h2v3.5H9zm4 0h2v3.5h-2zM2.5 9H6v2H2.5zm0 4H6v2H2.5zM18 9h3.5v2H18zm0 4h3.5v2H18z',
    syringe: 'M18.4 2.2l3.4 3.4-1.4 1.4-1-1-2.1 2.1 1 1-1.4 1.4-1-1-6.7 6.7-2.8.1-2.2 2.2-1.4-1.4 2.2-2.2.1-2.8 6.7-6.7-1-1 1.4-1.4 1 1 2.1-2.1-1-1z',
  };
  function renderHelps() {
    const box = $('#rsHelps');
    let L = null;
    try { L = sim && sim.helps ? sim.helps(simple()) : null; } catch (err) { console.error(err); }
    if (!L || !L.length) { box.hidden = true; return; }
    box.hidden = false;
    const h = L.map(([ic, t, x, src]) => `<li class="hp"><span class="hp-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${HICON[ic] || HICON.star}"/></svg></span><span class="hp-t">${t}</span><span class="hp-x">${x}${src && SRC[src] ? ` <span class="hp-src">(<a href="${SRC[src][1]}" target="_blank" rel="noopener">${SRC[src][2] || 'source'}</a>)</span>` : ''}</span></li>`).join('');
    const ul = $('#rsHelpsL'); if (ul._h !== h) { ul._h = h; ul.innerHTML = h; }
  }
  // "Why is this here?": the same physics as the station, with the student's own numbers next to the real machine's
  function renderLink() {
    const box = $('#rsLink');
    if (!sim || !sim.link) { box.hidden = true; linkDraw = null; return; }
    let L;
    try { L = sim.link(simple()); } catch (err) { console.error(err); box.hidden = true; linkDraw = null; return; }
    box.hidden = false;
    $('#rsLinkT').textContent = L.title;
    $('#rsLinkX').innerHTML = L.text;
    $('#rsLinkTab').innerHTML = `<table class="rs-link-table"><thead><tr><th scope="col"><span class="sr-only">Quantity</span></th><th scope="col">${L.cols[0]}</th><th scope="col">${L.cols[1]}</th></tr></thead><tbody>${L.rows.map(r => `<tr><th scope="row">${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>`;
    linkCv.setAttribute('aria-label', L.alt);
    linkDraw = L.draw;
  }
  function drawLink(dt) {
    if (!linkDraw || !linkSeen) return;
    if (!linkCtx || !LW) sizeLink();
    if (!LW) return;
    linkT += reduceMotion ? 0 : dt;
    try { linkDraw(linkCtx, LW, LH, reduceMotion ? 2.6 : linkT); } catch (err) { console.error(err); linkDraw = null; }
  }
  function sizeLink() {
    const w = linkCv.clientWidth;
    if (w < 20) return;
    const h = w < 520 ? 260 : 176;
    linkCv.style.height = h + 'px';
    ({ ctx: linkCtx } = fitCanvas(linkCv, w, h)); LW = w; LH = h;
  }
  function renderSpeeds() {
    const box = $('#rsSpeeds');
    box.innerHTML = sim.speeds.map(([k, t]) => `<label><input type="radio" name="rsspeed" value="${k}"${k === sim._speed ? ' checked' : ''}><span>${t}</span></label>`).join('');
    speedKey = sim._speed;
  }
  function changed() {
    const w = sim.wantSpeed && sim.wantSpeed();
    if (w) { sim._speed = w; renderSpeeds(); }
    sim.reset(); setRun('idle'); graphDirty = dataDirty = true; updateUI(true); renderLink(); renderWhy(); renderHelps();
  }
  function setRun(s) {
    runState = s;
    const b = $('#rsGo');
    if (b) { b.textContent = s === 'run' ? 'Pause' : s === 'pause' ? 'Resume' : s === 'done' ? 'Run again' : sim.go; b.classList.toggle('btn-go-hot', s === 'idle' || s === 'done'); b.setAttribute('aria-pressed', String(s === 'run')); }
  }
  function go() {
    audio.unlock();
    if (runState === 'run') setRun('pause');
    else if (runState === 'pause') setRun('run');
    else { if (runState === 'done') sim.reset(); setRun('run'); graphDirty = dataDirty = true; }
    updateUI(true);
  }

  function resize() {
    if (!host || !cv) return;
    const wrap = $('#rsWrap');
    if (v3 && v3.full) { const b = v3.fullBox(); cv.style.height = b.H + 'px'; ({ ctx } = fitCanvas(cv, b.W, b.H)); W = b.W; H = b.H; graphDirty = true; return; }
    cv.style.height = '';
    const w = wrap.clientWidth;
    if (w < 20) return;
    let h = Math.round(w < 560 ? clamp(w * 1.02, 300, 460) : clamp(w * 0.44, 320, 470));
    const main = wrap.parentElement, bar = $('#rsim .arena-bar');
    if (main && bar && getComputedStyle(main).overflowY === 'auto' && main.clientHeight > 0) h = Math.round(clamp(main.clientHeight - bar.offsetHeight - 14, 300, h));
    wrap.style.setProperty('--arena-h', h + 'px');
    ({ ctx } = fitCanvas(cv, w, h)); W = w; H = h;
    sizeLink();
    graphDirty = true;
  }
  const setText = (el, s) => { if (el && el.textContent !== s) el.textContent = s; };
  function updateUI(force) {
    if (!sim) return;
    const [st, cls] = sim.status(), hs = $('#rsStatus');
    setText(hs, st); hs.className = 'hud hud-status ' + (cls || '');
    const n = sim.narrate(), nx = $('#rsNarrate'); if (nx._h !== n) { nx._h = n; nx.innerHTML = n; }
    setText($('#rsClock'), sim.clock() + (speedKey !== '1' && (!sim.speedApplies || sim.speedApplies()) ? ` · ${(sim.speeds.find(s => s[0] === speedKey) || ['', ''])[1].toLowerCase()}` : ''));
    const T = sim.tiles(), box = $('#rsTiles');
    if (box.children.length !== T.length) box.innerHTML = T.map((t, i) => `<div class="tile tile-${'vkrn'[i]}"><div class="tile-label"></div><div class="tile-val"></div><div class="tile-sub"></div></div>`).join('');
    T.forEach((t, i) => { const el = box.children[i]; setText(el.children[0], t[0]); setText(el.children[1], t[1]); setText(el.children[2], t[2] || ' '); });
    if (force) { graphDirty = true; dataDirty = true; }
  }
  function drawGraphs() { try { sim.graphA($('#rsGA')); sim.graphB($('#rsGB')); } catch (err) { console.error(err); } }
  function renderData() {
    const body = $('#rsDataBody');
    let h;
    if (dataTab === 'numbers') h = simple() && sim.keyNumbers ? `<p class="hint">The most important numbers, in plain words. Switch to <b>Intermediate</b> for every step of the working.</p>${sim.keyNumbers()}` : sim.numbers();
    else if (dataTab === 'check') h = sim.check();
    else h = `<ul class="rs-src">${[...new Set(sim.sources.concat(sim.whySources || []))].filter(k => SRC[k]).map(k => `<li><a href="${SRC[k][1]}" target="_blank" rel="noopener">${esc(SRC[k][0])}</a></li>`).join('')}</ul><p class="hint">Numbers that are not published (for example the strength of the maglev’s motor or the jets’ maximum lift coefficient) are marked as estimates or assumptions where they are used.</p>`;
    body.innerHTML = h;
    setText($('#rsNumTab'), simple() ? 'Key numbers' : 'The numbers');
    $('#rsData').classList.toggle('no-working', !working);
    for (const b of $$('#rsData .tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === dataTab));
  }
  function frame(now, dt) {
    if (!host || !sim) return;
    if (!W || !ctx) resize();
    if (!W) return;
    const k = +speedKey || 1;
    if (runState === 'run') {
      let fin = false;
      try { fin = sim.step(dt * k, dt); } catch (err) { console.error(err); fin = true; }
      if (fin) { setRun('done'); graphDirty = dataDirty = true; updateUI(true); }
    }
    try { if (v3 && v3.on && sim.draw3d) sim.draw3d(v3.scene, ctx, W, H, dt, runState === 'run'); else sim.draw(ctx, W, H, dt, runState === 'run'); } catch (err) { console.error(err); }
    drawLink(dt);
    if (now - lastUI > 110) { lastUI = now; updateUI(); }
    if (graphDirty || (runState === 'run' && now - lastGraph > 220)) { lastGraph = now; graphDirty = false; drawGraphs(); }
    if (dataDirty || (runState === 'run' && now - lastData > 2000)) { lastData = now; dataDirty = false; renderData(); }
  }

  function init() {
    root = document.createElement('div');
    root.className = 'rsim'; root.id = 'rsim'; root.hidden = true;
    root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'Real life, simulated');
    root.innerHTML = shellHTML();
    document.body.appendChild(root);
    cv = $('#rsCanvas'); linkCv = $('#rsLinkCv');
    // the 3D key (with full screen); the real machines open in 3D unless the student switched it off before
    v3 = CL.V3.attach($('#rsWrap'), { storeKey: 'cl-rsim-3d', full: { bar: () => $('#rsim .arena-bar'), onChange: () => resize() }, onToggle: () => { graphDirty = true; } });
    if (store.get('cl-rsim-3d', null) === null) v3.set(true, true);
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { for (const e of es) linkSeen = e.isIntersecting; }).observe(linkCv);
    // the doors: a panel in each station's settings
    const near = (sel, up) => { const el = $(sel); return el ? el.closest(up) : null; };
    const spots = { lab: $('#accPartBox'), gauss: near('#ggTarget', '.panel'), collide: $$('#screen-collide .side > .panel').pop() };
    for (const [h, after] of Object.entries(spots)) {
      if (!after) continue;
      after.insertAdjacentHTML('afterend', entryHTML(h));
      const panel = after.nextElementSibling;
      panel.addEventListener('click', ev => { const b = ev.target.closest('[data-open-sim]'); if (b) open(b.dataset.openSim, h); });
    }
    $('#rsBack').addEventListener('click', close);
    whyOpen = store.get('cl-rsim-why', true) !== false;
    $('#rsWhyCmp').addEventListener('click', ev => {
      const b = ev.target.closest('[data-why]'); if (!b || !sim || !sim.setWithout) return;
      const off = b.dataset.why === 'off';
      if (b.getAttribute('aria-checked') === 'true') return;
      sim.setWithout(off);
      changed();
      const nb = $(`#rsWhyCmp [data-why="${off ? 'off' : 'on'}"]`); if (nb) nb.focus({ preventScroll: true });
    });
    $('#rsWhyCmp').addEventListener('keydown', ev => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
      const b = ev.target.closest('[data-why]'); if (!b) return;
      ev.preventDefault();
      const other = $(`#rsWhyCmp [data-why="${b.dataset.why === 'off' ? 'on' : 'off'}"]`); if (other) other.click();
    });
    $('#rsWhyFold').addEventListener('click', () => { whyOpen = !whyOpen; store.set('cl-rsim-why', whyOpen); renderWhy(); requestAnimationFrame(resize); });
    root.querySelector('.rsim-picks').addEventListener('click', ev => { const b = ev.target.closest('[data-sim]'); if (b && b.dataset.sim !== cur) select(b.dataset.sim); });
    root.querySelector('.rsim-picks').addEventListener('keydown', ev => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      const i = ORDER.indexOf(cur), j = (i + (ev.key === 'ArrowRight' ? 1 : ORDER.length - 1)) % ORDER.length;
      ev.preventDefault(); select(ORDER[j]); $('#rsTab-' + ORDER[j]).focus();
    });
    $('#rsGo').addEventListener('click', go);
    $('#rsReset').addEventListener('click', () => { sim.reset(); setRun('idle'); graphDirty = dataDirty = true; updateUI(true); });
    $('#rsSpeeds').addEventListener('change', ev => { if (ev.target.name === 'rsspeed') { speedKey = sim._speed = ev.target.value; updateUI(); } });
    $('#rsData .tabs').addEventListener('click', ev => { const b = ev.target.closest('[data-tab]'); if (!b) return; dataTab = b.dataset.tab; renderData(); });
    $('#rsWorking').addEventListener('change', ev => { working = ev.target.checked; $('#rsData').classList.toggle('no-working', !working); });
    document.addEventListener('keydown', ev => {
      if (!host || CL.active !== host) return;
      const t = ev.target, tag = t.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SUMMARY' || t.isContentEditable) return;
      if (ev.key === ' ') { ev.preventDefault(); go(); }
    });
    bus.on('screen', name => {
      if (host && name === host && CL.screens[host] && CL.screens[host].hide) CL.screens[host].hide();   // the station stays paused behind its simulation
      if (host && name === host) requestAnimationFrame(resize);
    });
    bus.on('skin', () => { graphDirty = true; });
    bus.on('level', name => {
      const w = $('#rsWorking'); if (w && w.checked !== (name === 'full')) { w.checked = name === 'full'; working = w.checked; }
      if (!sim) return;
      dataDirty = graphDirty = true; renderLink(); renderWhy(); renderHelps(); updateUI(true);
      if (host) requestAnimationFrame(resize);
    });
    window.addEventListener('resize', () => { if (host) requestAnimationFrame(resize); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (host) resize(); }).observe($('#rsWrap'));
  }

  CL.realsim = { init, open, close, frame, resize, SIM, HOSTS, get host() { return host; }, get current() { return cur; }, get sim() { return sim; }, get state() { return runState; }, get v3() { return v3; }, reselect: () => { if (cur) select(cur); } };
})();
