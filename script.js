/* ==============================================
   SecureU - script.js
   Simple JavaScript using functions, if-else, loops
   and localStorage (no frameworks, no async/await)
   ============================================== */

// This keeps track of who is logged in right now
var currentUserEmail = "";
var currentUserName = "";
var currentMood = "";

/* ----------------------------------------------
   FIREBASE CLOUD SYNC
   LocalStorage remains the offline cache. When Firebase is configured
   and the device is online, reports and feedback are also saved to Firestore.
---------------------------------------------- */
function syncReportToFirebase(report) {
  if (typeof secureuFirebaseReady !== "function" || secureuFirebaseReady() === false) return;
  if (!window.firebase || !firebase.auth().currentUser) return;
  var data = {
    uid: firebase.auth().currentUser.uid,
    email: currentUserEmail,
    type: report.type,
    location: report.location,
    date: report.date,
    description: report.description,
    contact: report.contact || "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  firebase.firestore().collection("reports").add(data).catch(function(err){ console.log("Firebase report sync failed:", err); });
}

function syncFeedbackToFirebase(feedback) {
  if (typeof secureuFirebaseReady !== "function" || secureuFirebaseReady() === false) return;
  if (!window.firebase || !firebase.auth().currentUser) return;
  var data = {
    category: feedback.category,
    location: feedback.location || "",
    description: feedback.description,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  firebase.firestore().collection("feedback").add(data).catch(function(err){ console.log("Firebase feedback sync failed:", err); });
}

/* ----------------------------------------------
   HELPER FUNCTIONS - reading/writing localStorage
---------------------------------------------- */
function getArray(key) {
  var data = localStorage.getItem(key);
  if (data === null) {
    return [];
  }
  return JSON.parse(data);
}

function saveArray(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

// Turns any text safe to put inside HTML (prevents broken layout / script injection)
function escapeText(str) {
  if (!str) {
    return "";
  }
  var div = document.createElement("div");
  div.innerText = str;
  return div.innerHTML;
}

/* ----------------------------------------------
   PAGE LOAD - check if someone is already logged in
---------------------------------------------- */
window.onload = function () {
  var savedEmail = localStorage.getItem("su_currentUser");

  if (savedEmail !== null) {
    var users = getArray("su_users");
    var i;
    for (i = 0; i < users.length; i++) {
      if (users[i].email === savedEmail) {
        startApp(users[i].email, users[i].name);
        break;
      }
    }
  }

  // apply saved settings (theme, font size, contrast, language)
  applySavedSettings();

  // check online/offline status
  updateOfflineBar();

  // register the service worker so the app works offline
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
};

window.addEventListener("online", updateOfflineBar);
window.addEventListener("offline", updateOfflineBar);

function updateOfflineBar() {
  var bar = document.getElementById("offlineBar");
  if (navigator.onLine === false) {
    bar.className = "show";
  } else {
    bar.className = "";
  }
}

/* ----------------------------------------------
   LOGIN / SIGN UP
---------------------------------------------- */
function showLoginForm() {
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("showLoginBtn").className = "switchBtn active";
  document.getElementById("showSignupBtn").className = "switchBtn";
  document.getElementById("authError").innerText = "";
}

function showSignupForm() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "block";
  document.getElementById("showLoginBtn").className = "switchBtn";
  document.getElementById("showSignupBtn").className = "switchBtn active";
  document.getElementById("authError").innerText = "";
}

function showAuthError(msg) {
  document.getElementById("authError").innerText = msg;
}

function isGmail(email) {
  // Simple check: must end with @gmail.com
  var lower = email.toLowerCase();
  if (lower.indexOf("@gmail.com") === -1) {
    return false;
  }
  if (lower.endsWith("@gmail.com") === false) {
    return false;
  }
  return true;
}

function signup() {
  var name = document.getElementById("suName").value.trim();
  var email = document.getElementById("suEmail").value.trim();
  var pass = document.getElementById("suPassword").value;
  if (name === "" || email === "" || pass === "") { showAuthError("Please fill in all fields."); return; }
  if (isGmail(email) === false) { showAuthError("Please use a valid Gmail address (must end with @gmail.com)."); return; }
  if (pass.length < 6) { showAuthError("Password must be at least 6 characters for Firebase."); return; }

  if (typeof secureuFirebaseReady === "function" && secureuFirebaseReady()) {
    firebase.auth().createUserWithEmailAndPassword(email, pass).then(function(cred){
      return cred.user.updateProfile({displayName:name}).then(function(){
        return firebase.firestore().collection("profiles").doc(cred.user.uid).set({name:name,email:email,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      }).then(function(){
        localStorage.setItem("su_currentUser", email);
        startApp(email, name);
      });
    }).catch(function(err){ showAuthError(err.message || "Could not create the Firebase account."); });
    return;
  }

  var users = getArray("su_users");
  for (var i = 0; i < users.length; i++) if (users[i].email === email) { showAuthError("An account already exists with this email. Please login instead."); return; }
  users.push({ name:name, email:email, password:pass }); saveArray("su_users", users);
  localStorage.setItem("su_currentUser", email); startApp(email, name);
}

function login() {
  var email = document.getElementById("liEmail").value.trim();
  var pass = document.getElementById("liPassword").value;
  if (email === "" || pass === "") { showAuthError("Please enter your email and password."); return; }
  if (typeof secureuFirebaseReady === "function" && secureuFirebaseReady()) {
    firebase.auth().signInWithEmailAndPassword(email, pass).then(function(cred){
      var name = cred.user.displayName || email.split("@")[0];
      return firebase.firestore().collection("profiles").doc(cred.user.uid).get().then(function(doc){
        if (doc.exists && doc.data().name) name = doc.data().name;
        localStorage.setItem("su_currentUser", email); startApp(email, name);
      });
    }).catch(function(err){ showAuthError(err.message || "Incorrect email or password."); });
    return;
  }
  var users = getArray("su_users"), found = null;
  for (var i=0;i<users.length;i++) if(users[i].email===email && users[i].password===pass){found=users[i];break;}
  if(found===null){showAuthError("Incorrect email or password.");return;}
  localStorage.setItem("su_currentUser", email); startApp(found.email, found.name);
}

function logout() {
  localStorage.removeItem("su_currentUser");
  if (typeof secureuFirebaseReady === "function" && secureuFirebaseReady()) { firebase.auth().signOut().finally(function(){ location.reload(); }); }
  else { location.reload(); }
}

function startApp(email, name) {
  currentUserEmail = email;
  currentUserName = name;

  document.getElementById("authSection").style.display = "none";
  document.getElementById("mainApp").style.display = "block";
  document.getElementById("chatFab").style.display = "flex";

  document.getElementById("heroGreeting").innerText = "Hello, " + name + "!";

  loadProfile();
  renderContacts();
  renderGuide();
  renderMoodHistory();
  renderReports();
  renderFeedback();
  renderAlerts();
  renderAnalytics();
  updateHomeStats();
  initCampusFeatures();
  initAttendancePlanner();
}

/* ----------------------------------------------
   PAGE NAVIGATION
---------------------------------------------- */
function showPage(pageId) {
  var pages = document.getElementsByClassName("page");
  var i;
  for (i = 0; i < pages.length; i++) {
    pages[i].style.display = "none";
  }
  var target = document.getElementById(pageId);
  target.style.display = "block";
  target.className = "page fade-in";

  // Highlight the active section in the redesigned navigation.
  var navMap = {
    "page-home":"navHomeBtn", "page-contacts":"navContactsBtn", "page-guide":"navGuideBtn",
    "page-checkin":"navCheckinBtn", "page-report":"navReportBtn", "page-feedback":"navFbBtn",
    "page-analytics":"navAnBtn", "page-profile":"navPrBtn", "page-campus":"navCampusBtn",
    "page-seniors":"navSeniorBtn", "page-new-student":"navFirstBtn", "page-attendance":"navAttendanceBtn"
  };
  var navButtons = document.querySelectorAll('.navBtn');
  for (var nb = 0; nb < navButtons.length; nb++) navButtons[nb].classList.remove('navActive');
  if (navMap[pageId] && document.getElementById(navMap[pageId])) document.getElementById(navMap[pageId]).classList.add('navActive');

  if (pageId === "page-analytics") {
    renderAnalytics();
  }

  // update the browser tab title to match the page (small polish touch)
  var pageTitles = {
    "page-home": "SecureU - Home",
    "page-contacts": "SecureU - Emergency Contacts",
    "page-guide": "SecureU - Safety Guide",
    "page-checkin": "SecureU - Wellbeing Check-in",
    "page-report": "SecureU - Report an Issue",
    "page-feedback": "SecureU - Anonymous Feedback",
    "page-analytics": "SecureU - My Insights",
    "page-profile": "SecureU - Profile",
    "page-campus": "SecureU - Smart Campus",
    "page-seniors": "SecureU - Senior Knowledge Hub",
    "page-new-student": "SecureU - First Year",
    "page-attendance": "SecureU - Attendance & Timetable"
  };
  if (pageTitles[pageId] !== undefined) {
    document.title = pageTitles[pageId];
  }
}

function showTab(group, tabName, clickEvent) {
  // group is "report"
  if (group === "report") {
    document.getElementById("report-new").style.display = tabName === "new" ? "block" : "none";
    document.getElementById("report-mine").style.display = tabName === "mine" ? "block" : "none";
    if (tabName === "mine") {
      renderReports();
    }
  }

  // highlight the active tab button (only if this was triggered by an actual click)
  if (clickEvent) {
    var tabButtons = clickEvent.target.parentElement.getElementsByClassName("tabBtn");
    var i;
    for (i = 0; i < tabButtons.length; i++) {
      tabButtons[i].className = "tabBtn";
    }
    clickEvent.target.className = "tabBtn active";
  }
}

/* ----------------------------------------------
   EMERGENCY CONTACTS
---------------------------------------------- */
function renderContacts() {
  var profile = getProfile();
  var securityNumber = profile.securityNum ? profile.securityNum : "100";
  var counsellorNumber = profile.counsellorNum ? profile.counsellorNum : "18005990019";

  var html = "";

  html += contactCardHtml("Campus Security", profile.securityNum ? profile.securityNum : "100 (police, until campus number is added)", securityNumber);
  html += contactCardHtml("Ambulance", "108", "108");
  html += contactCardHtml("Police", "100 / 112", "100");
  html += contactCardHtml("Fire Service", "101", "101");
  html += contactCardHtml("Student Counsellor", profile.counsellorNum ? profile.counsellorNum : "1800-599-0019 (KIRAN Mental Health)", counsellorNumber);

  document.getElementById("contactsList").innerHTML = html;

  // keep panic mode's Security button matching the saved campus number
  document.getElementById("panicSecurityLink").setAttribute("href", "tel:" + securityNumber);
}

function contactCardHtml(name, displayNumber, telNumber) {
  return '<div class="contactCard">' +
    '<div class="cInfo"><strong>' + name + '</strong><span>' + displayNumber + '</span></div>' +
    '<a class="callBtn" href="tel:' + telNumber + '">Call</a>' +
    '</div>';
}

/* ----------------------------------------------
   SAFETY RESOURCES (national helplines list, added to guide page)
---------------------------------------------- */
var RESOURCES = [
  { name: "Counselling - KIRAN Mental Health Helpline", number: "18005990019", display: "1800-599-0019" },
  { name: "Anti-Ragging Helpline (UGC)", number: "18001805522", display: "1800-180-5522" },
  { name: "Women's Safety - National Women Helpline", number: "181", display: "181" },
  { name: "Women's Safety - Women Helpline", number: "1091", display: "1091" },
  { name: "Cybercrime Helpline", number: "1930", display: "1930" }
];

/* ----------------------------------------------
   SAFETY GUIDE (accordion, works offline since it is plain text)
---------------------------------------------- */
var GUIDE_SECTIONS = [
  {
    title: "First Aid Basics",
    body: "<strong>Before anything else:</strong> make sure the area itself is safe, then check if the person responds to your voice or a gentle shoulder tap.<br><br>" +
      "<strong>Bleeding:</strong> press a clean cloth firmly on the wound and keep the pressure on until it slows down.<br><br>" +
      "<strong>Burns:</strong> hold the area under cool running water for at least 10 minutes - don't apply ice or ointments.<br><br>" +
      "<strong>Not breathing or unresponsive:</strong> call 108 immediately and stay on the line, they'll talk you through what to do next.<br><br>" +
      "<strong>Suspected spine or neck injury:</strong> don't move the person unless they're in immediate danger (like fire or traffic).<br><br>" +
      "For any serious injury, call 108 first, then give whatever help you can while it's on the way."
  },
  {
    title: "Reporting Harassment",
    body: "1. Your safety comes first - move to a public, well-lit area.<br>" +
      "2. Use Report an Issue or Anonymous Feedback to log what happened.<br>" +
      "3. Note the time, location, and any details you remember.<br>" +
      "4. Contact your counsellor or Women's helpline (181 / 1091) for support.<br>" +
      "5. Ragging cases can be reported to the UGC helpline: 1800-180-5522."
  },
  {
    title: "Lost &amp; Found Procedure",
    body: "1. Post the item under Lost &amp; Found with a clear description.<br>" +
      "2. Check the board regularly for updates.<br>" +
      "3. For valuable items (ID cards, wallets, laptops) also inform campus security.<br>" +
      "4. Remove your post once you are reunited with the item."
  },
  {
    title: "Fire Emergencies",
    body: "1. Activate the nearest fire alarm and alert others.<br>" +
      "2. Call 101 (Fire Service) as soon as it is safe.<br>" +
      "3. Leave via the nearest marked exit - never use lifts during a fire.<br>" +
      "4. If trapped in smoke, stay low to the ground.<br>" +
      "5. Go to your building's assembly point and wait to be accounted for."
  },
  {
    title: "Personal Safety Tips",
    body: "1. Share your route with a friend when heading out at night.<br>" +
      "2. Keep well-lit, populated routes as your default.<br>" +
      "3. Keep your phone charged and try Panic Mode for quick access.<br>" +
      "4. Trust your instincts - if something feels wrong, leave.<br>" +
      "5. Save campus security's number as a speed dial."
  }
];

function renderGuide() {
  var searchBox = document.getElementById("guideSearch");
  var query = searchBox.value.trim().toLowerCase();

  var html = "";
  var i;
  var matchCount = 0;

  for (i = 0; i < GUIDE_SECTIONS.length; i++) {
    var combinedText = (GUIDE_SECTIONS[i].title + " " + GUIDE_SECTIONS[i].body).toLowerCase();
    if (query === "" || combinedText.indexOf(query) !== -1) {
      matchCount = matchCount + 1;
      html += '<div class="guideItem">' +
        '<button class="guideHeader" onclick="toggleGuide(' + i + ')">' + GUIDE_SECTIONS[i].title + '</button>' +
        '<div class="guideBody" id="guideBody' + i + '">' + GUIDE_SECTIONS[i].body + '</div>' +
        '</div>';
    }
  }

  if (matchCount === 0) {
    html = '<p class="emptyMsg">No matching guide sections. Try a different word.</p>';
  }

  // add the national safety resources at the bottom - only when not searching,
  // so a search for "fire" doesn't also show every helpline
  if (query === "") {
    html += '<h3 class="sectionTitle">National Helplines</h3>';
    for (i = 0; i < RESOURCES.length; i++) {
      html += contactCardHtml(RESOURCES[i].name, RESOURCES[i].display, RESOURCES[i].number);
    }
  }

  document.getElementById("guideList").innerHTML = html;
}

function toggleGuide(index) {
  var body = document.getElementById("guideBody" + index);
  if (body.style.display === "block") {
    body.style.display = "none";
  } else {
    body.style.display = "block";
  }
}

/* ----------------------------------------------
   WELLBEING CHECK-IN
---------------------------------------------- */
function selectMood(mood, btn) {
  currentMood = mood;

  var buttons = document.getElementsByClassName("moodBtn");
  var i;
  for (i = 0; i < buttons.length; i++) {
    buttons[i].className = "moodBtn";
  }
  btn.className = "moodBtn selected";
}

function submitCheckin() {
  if (currentMood === "") {
    alert("Please select a mood first.");
    return;
  }

  var note = document.getElementById("moodNote").value.trim();
  var list = getArray("su_checkins_" + currentUserEmail);

  var entry = {
    mood: currentMood,
    note: note,
    date: new Date().toLocaleString()
  };
  list.unshift(entry);
  saveArray("su_checkins_" + currentUserEmail, list);

  // reset the form
  document.getElementById("moodNote").value = "";
  currentMood = "";
  var buttons = document.getElementsByClassName("moodBtn");
  var i;
  for (i = 0; i < buttons.length; i++) {
    buttons[i].className = "moodBtn";
  }

  renderMoodHistory();
  updateHomeStats();
  alert("Check-in saved!");
}

function renderMoodHistory() {
  var list = getArray("su_checkins_" + currentUserEmail);
  var html = "";

  if (list.length === 0) {
    html = '<p class="emptyMsg">No check-ins yet.</p>';
  } else {
    var i;
    // only show the most recent 10
    var limit = list.length < 10 ? list.length : 10;
    for (i = 0; i < limit; i++) {
      html += '<div class="historyRow"><strong>' + list[i].mood + '</strong>';
      if (list[i].note !== "") {
        html += ' - ' + escapeText(list[i].note);
      }
      html += '<br><small>' + list[i].date + '</small></div>';
    }
  }

  document.getElementById("moodHistoryList").innerHTML = html;
}

/* ----------------------------------------------
   REPORT AN ISSUE
---------------------------------------------- */

// Shown to the student immediately after they submit a report,
// tailored to what kind of issue they reported.
var ASSISTANCE_TIPS = {
  "Harassment": "Move to a safe, public area if you haven't already. You can call your Student Counsellor or the Women's Helpline (181 / 1091) right now from the Emergency Contacts page. You're also welcome to use Anonymous Feedback if you'd rather not attach your name.",
  "Theft": "Write down the time and place while it's fresh in your memory. Please also inform Campus Security directly using the Call button on the Emergency Contacts page.",
  "Unsafe / poorly lit area": "Thanks for flagging this - it helps make campus safer for everyone. If possible, avoid the area until it's fixed.",
  "Maintenance hazard": "If this is an immediate danger (exposed wiring, gas smell, structural damage), please also call Campus Security right now from the Emergency Contacts page - don't wait for a reply to this report.",
  "Medical emergency": "If this is happening right now, call 108 (Ambulance) immediately from the Emergency Contacts page. Do not wait for a response to this report.",
  "Ragging": "You can also call the national Anti-Ragging Helpline any time: 1800-180-5522 (24x7, confidential).",
  "Other": "Thank you for reporting this. If it's urgent, please also use the SOS button in Panic Mode.",
  "Unsafe area": "Thanks for flagging this - it helps make campus safer for everyone. If possible, avoid the area until it's addressed.",
  "Other concern": "Thank you for sharing this. If it's urgent, please also use the SOS button in Panic Mode or speak to your Student Counsellor.",
  "Lost Item": "This has been saved under My Reports along with your contact info. Check back to update it once you're reunited with your item, or if campus security needs more details.",
  "Found Item": "Thank you for reporting this! Please also hand valuable items (ID cards, wallets, electronics) to Campus Security directly so the owner can be found faster."
};

// Shows the "Your contact info" field only when reporting a lost or found item -
// other issue types don't need it.
function onReportTypeChange() {
  var type = document.getElementById("rType").value;
  var contactField = document.getElementById("rContactField");
  if (type === "Lost Item" || type === "Found Item") {
    contactField.style.display = "block";
  } else {
    contactField.style.display = "none";
    document.getElementById("rContact").value = "";
  }
}

function submitReport() {
  var type = document.getElementById("rType").value;
  var location = document.getElementById("rLocation").value.trim();
  var date = document.getElementById("rDate").value;
  var desc = document.getElementById("rDesc").value.trim();
  var contact = document.getElementById("rContact").value.trim();
  var isLostOrFound = (type === "Lost Item" || type === "Found Item");

  if (type === "" || location === "" || date === "" || desc === "") {
    alert("Please fill in every field.");
    return;
  }
  if (isLostOrFound && contact === "") {
    alert("Please add a contact so someone can reach you about this item.");
    return;
  }

  var list = getArray("su_reports_" + currentUserEmail);
  var newReport = {
    id: Date.now(),
    type: type,
    location: location,
    date: date,
    description: desc,
    contact: contact
  };
  list.unshift(newReport);
  saveArray("su_reports_" + currentUserEmail, list);
  syncReportToFirebase(newReport);

  document.getElementById("reportForm").reset();
  document.getElementById("rContactField").style.display = "none";
  renderReports();
  updateHomeStats();

  // Show the student some immediate, relevant guidance
  showAssistance("reportAssistance", type);

  alert("Report saved" + (navigator.onLine ? "." : " (you're offline, but it's safely saved on this device)."));
}

function showAssistance(boxId, issueType) {
  var box = document.getElementById(boxId);
  var tip = ASSISTANCE_TIPS[issueType];
  if (tip === undefined) {
    tip = ASSISTANCE_TIPS["Other"];
  }
  box.innerHTML = "<strong>While you wait:</strong><p>" + tip + "</p>";
  box.style.display = "block";
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderReports() {
  var list = getArray("su_reports_" + currentUserEmail);
  var searchBox = document.getElementById("reportSearch");
  var query = searchBox ? searchBox.value.trim().toLowerCase() : "";

  var filtered = [];
  var i;
  for (i = 0; i < list.length; i++) {
    var combinedText = (list[i].type + " " + list[i].location + " " + list[i].description).toLowerCase();
    if (query === "" || combinedText.indexOf(query) !== -1) {
      filtered.push(list[i]);
    }
  }

  var html = "";
  if (filtered.length === 0) {
    html = '<p class="emptyMsg">No reports found.</p>';
  } else {
    for (i = 0; i < filtered.length; i++) {
      var tagClass = "tag";
      if (filtered[i].type === "Lost Item") {
        tagClass = "tag lost";
      }
      if (filtered[i].type === "Found Item") {
        tagClass = "tag found";
      }

      html += '<div class="listCard">' +
        '<button class="deleteBtn" onclick="deleteReport(' + filtered[i].id + ')">Delete</button>' +
        '<span class="' + tagClass + '">' + filtered[i].type + '</span>' +
        '<h4>' + escapeText(filtered[i].location) + '</h4>' +
        '<p>' + escapeText(filtered[i].description) + '</p>' +
        '<div class="meta">Date: ' + filtered[i].date +
        (filtered[i].contact ? ' | Contact: ' + escapeText(filtered[i].contact) : '') +
        '</div>' +
        '</div>';
    }
  }

  document.getElementById("reportsList").innerHTML = html;
}

function deleteReport(id) {
  var confirmDelete = confirm("Delete this report? This cannot be undone.");
  if (confirmDelete === false) {
    return;
  }

  var list = getArray("su_reports_" + currentUserEmail);
  var newList = [];
  var i;
  for (i = 0; i < list.length; i++) {
    if (list[i].id !== id) {
      newList.push(list[i]);
    }
  }
  saveArray("su_reports_" + currentUserEmail, newList);
  renderReports();
  updateHomeStats();
}

/* ----------------------------------------------
   ANONYMOUS FEEDBACK (no name/email saved with it, on purpose)
---------------------------------------------- */
function submitFeedback() {
  var category = document.getElementById("fbCategory").value;
  var location = document.getElementById("fbLocation").value.trim();
  var desc = document.getElementById("fbDesc").value.trim();

  if (category === "" || desc === "") {
    alert("Please select a category and describe the issue.");
    return;
  }

  var list = getArray("su_feedback");
  list.unshift({
    id: Date.now(),
    category: category,
    location: location,
    description: desc,
    date: new Date().toLocaleDateString()
    // no "owner" or name is stored here - this keeps it anonymous
  });
  saveArray("su_feedback", list);
  syncFeedbackToFirebase({ category: category, location: location, description: desc });

  document.querySelector("#page-feedback form").reset();
  showAssistance("feedbackAssistance", category);
  alert("Submitted anonymously. Thank you.");
  renderFeedback();
}

function renderFeedback() {
  var list = getArray("su_feedback");
  var html = "";

  if (list.length === 0) {
    html = '<p class="emptyMsg">No feedback submitted yet.</p>';
  } else {
    var i;
    for (i = 0; i < list.length; i++) {
      html += '<div class="listCard">' +
        '<span class="tag">' + list[i].category + '</span>' +
        '<p>' + escapeText(list[i].description) + '</p>' +
        '<div class="meta">' + (list[i].location ? "Location: " + escapeText(list[i].location) + " | " : "") + list[i].date + '</div>' +
        '</div>';
    }
  }

  document.getElementById("feedbackList").innerHTML = html;
}

/* ----------------------------------------------
   SHARE MY ROUTE
   ------------------------------------------------
   Lets a student quickly send a "heading to X, leaving now" message
   to a trusted contact before walking somewhere alone.
---------------------------------------------- */
function shareRoute() {
  var destination = prompt("Where are you heading? (e.g. Library, Hostel Block B)");
  if (destination === null || destination.trim() === "") {
    return;
  }

  var now = new Date().toLocaleString();
  var message = "I'm heading to " + destination.trim() + ". Leaving now at " + now + ". I will message when I arrive.";

  if (navigator.share) {
    // Modern phones: opens the native share sheet (WhatsApp, SMS, etc.)
    navigator.share({ title: "My Route", text: message }).catch(function () {
      // user cancelled the share sheet - nothing else to do
    });
  } else {
    // Older browsers without share support: copy the message instead
    copyTextFallback(message);
    alert("Sharing isn't supported on this browser, so this message has been copied instead:\n\n" + message + "\n\nPaste it to a trusted contact.");
  }
}

function copyTextFallback(text) {
  var textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
  } catch (e) {
    // clipboard copy not supported either - the alert box still shows the message
  }
  document.body.removeChild(textarea);
}

/* ----------------------------------------------
   PANIC MODE + SOS
---------------------------------------------- */
function showPanic() {
  document.getElementById("panicOverlay").className = "show";
}

function hidePanic() {
  document.getElementById("panicOverlay").className = "";
}

function prepareSOS() {
  // Try to get the user's location. This uses a callback (not a Promise)
  // which is the simplest way to use the Geolocation API.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (position) {
        var lat = position.coords.latitude.toFixed(4);
        var lng = position.coords.longitude.toFixed(4);
        var locationText = "Lat " + lat + ", Lng " + lng;
        saveSOS(locationText, "granted");
      },
      function () {
        // user said no, or it failed
        saveSOS("Location not shared", "declined");
      }
    );
  } else {
    saveSOS("Location not available on this device", "unavailable");
  }
}

function saveSOS(locationText, consent) {
  var list = getArray("su_sos_" + currentUserEmail);
  var now = new Date().toLocaleString();

  list.unshift({
    date: now,
    location: locationText,
    consent: consent
  });
  saveArray("su_sos_" + currentUserEmail, list);
  renderAlerts();

  alert("SOS message prepared:\n\nI need help.\nTime: " + now + "\nLocation: " + locationText +
    "\n\n(In a real deployment this would also notify campus security. For now, please also use the Call buttons.)");
}

function renderAlerts() {
  var list = getArray("su_sos_" + currentUserEmail);
  var html = "";

  if (list.length === 0) {
    html = '<p class="emptyMsg">No alerts prepared yet.</p>';
  } else {
    var i;
    for (i = 0; i < list.length; i++) {
      html += '<div class="listCard">' +
        '<span class="tag">' + list[i].consent + '</span>' +
        '<p>' + list[i].location + '</p>' +
        '<div class="meta">' + list[i].date + '</div>' +
        '</div>';
    }
  }

  document.getElementById("alertsList").innerHTML = html;
}

/* ----------------------------------------------
   ANALYTICS (simple bar charts made from plain divs)
---------------------------------------------- */
function renderAnalytics() {
  var checkins = getArray("su_checkins_" + currentUserEmail);
  var moods = ["Happy", "Calm", "Stressed", "Sad", "Anxious"];
  var moodCounts = {};
  var i;

  for (i = 0; i < moods.length; i++) {
    moodCounts[moods[i]] = 0;
  }
  for (i = 0; i < checkins.length; i++) {
    moodCounts[checkins[i].mood] = moodCounts[checkins[i].mood] + 1;
  }

  var maxMoodCount = 1;
  for (i = 0; i < moods.length; i++) {
    if (moodCounts[moods[i]] > maxMoodCount) {
      maxMoodCount = moodCounts[moods[i]];
    }
  }

  var moodHtml = "";
  for (i = 0; i < moods.length; i++) {
    var percent = Math.round((moodCounts[moods[i]] / maxMoodCount) * 100);
    moodHtml += '<div class="bar-row">' +
      '<span class="bar-label">' + moods[i] + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + percent + '%"></div></div>' +
      '<span class="bar-count">' + moodCounts[moods[i]] + '</span>' +
      '</div>';
  }
  document.getElementById("moodChart").innerHTML = moodHtml;

  // Report types chart
  var reports = getArray("su_reports_" + currentUserEmail);
  var typeCounts = {};
  var typeNames = [];

  for (i = 0; i < reports.length; i++) {
    var t = reports[i].type;
    if (typeCounts[t] === undefined) {
      typeCounts[t] = 0;
      typeNames.push(t);
    }
    typeCounts[t] = typeCounts[t] + 1;
  }

  var issueHtml = "";
  if (typeNames.length === 0) {
    issueHtml = '<p class="emptyMsg">No reports yet.</p>';
  } else {
    var maxIssueCount = 1;
    for (i = 0; i < typeNames.length; i++) {
      if (typeCounts[typeNames[i]] > maxIssueCount) {
        maxIssueCount = typeCounts[typeNames[i]];
      }
    }
    for (i = 0; i < typeNames.length; i++) {
      var pct = Math.round((typeCounts[typeNames[i]] / maxIssueCount) * 100);
      issueHtml += '<div class="bar-row">' +
        '<span class="bar-label">' + typeNames[i] + '</span>' +
        '<div class="bar-track"><div class="bar-fill orange" style="width:' + pct + '%"></div></div>' +
        '<span class="bar-count">' + typeCounts[typeNames[i]] + '</span>' +
        '</div>';
    }
  }
  document.getElementById("issueChart").innerHTML = issueHtml;
}

/* ----------------------------------------------
   HOME PAGE STATS
---------------------------------------------- */
function updateHomeStats() {
  var checkins = getArray("su_checkins_" + currentUserEmail);
  var reports = getArray("su_reports_" + currentUserEmail);

  document.getElementById("statCheckins").innerText = checkins.length;
  document.getElementById("statReports").innerText = reports.length;

  // count how many days in a row (including today) have at least one check-in
  var daysWithCheckin = [];
  var i;
  for (i = 0; i < checkins.length; i++) {
    var d = new Date(checkins[i].date).toDateString();
    if (daysWithCheckin.indexOf(d) === -1) {
      daysWithCheckin.push(d);
    }
  }

  var streak = 0;
  var checkDate = new Date();
  while (daysWithCheckin.indexOf(checkDate.toDateString()) !== -1) {
    streak = streak + 1;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  document.getElementById("statStreak").innerText = streak;
}

/* ----------------------------------------------
   PROFILE / STUDENT DETAILS
---------------------------------------------- */
function getProfile() {
  var data = localStorage.getItem("su_profile_" + currentUserEmail);
  if (data === null) {
    return {};
  }
  return JSON.parse(data);
}

function loadProfile() {
  var profile = getProfile();
  document.getElementById("pName").value = profile.name ? profile.name : currentUserName;
  document.getElementById("pBlood").value = profile.blood ? profile.blood : "";
  document.getElementById("pAllergies").value = profile.allergies ? profile.allergies : "";
  document.getElementById("pEmergencyContact").value = profile.emergencyContact ? profile.emergencyContact : "";
  document.getElementById("pSecurityNum").value = profile.securityNum ? profile.securityNum : "";
  document.getElementById("pCounsellorNum").value = profile.counsellorNum ? profile.counsellorNum : "";
}

function saveProfile() {
  var profile = {
    name: document.getElementById("pName").value.trim(),
    blood: document.getElementById("pBlood").value.trim(),
    allergies: document.getElementById("pAllergies").value.trim(),
    emergencyContact: document.getElementById("pEmergencyContact").value.trim(),
    securityNum: document.getElementById("pSecurityNum").value.trim(),
    counsellorNum: document.getElementById("pCounsellorNum").value.trim()
  };
  localStorage.setItem("su_profile_" + currentUserEmail, JSON.stringify(profile));
  alert("Profile saved on this device.");
  renderContacts(); // refresh contact numbers in case they changed
}

function eraseMyData() {
  var confirmErase = confirm("This will permanently delete all your check-ins, reports, alerts and profile from this device. Continue?");
  if (confirmErase === false) {
    return;
  }
  localStorage.removeItem("su_checkins_" + currentUserEmail);
  localStorage.removeItem("su_reports_" + currentUserEmail);
  localStorage.removeItem("su_sos_" + currentUserEmail);
  localStorage.removeItem("su_profile_" + currentUserEmail);
  alert("Your data has been erased.");
  location.reload();
}

/* ----------------------------------------------
   ACCESSIBILITY CONTROLS
---------------------------------------------- */
function toggleDarkMode() {
  var isDark = document.body.classList.contains("dark");
  if (isDark) {
    document.body.classList.remove("dark");
    localStorage.setItem("su_theme", "light");
  } else {
    document.body.classList.add("dark");
    localStorage.setItem("su_theme", "dark");
  }
}

function setFontSize(size) {
  document.body.style.fontSize = size;
  localStorage.setItem("su_fontsize", size);
}

function toggleContrast() {
  var checked = document.getElementById("contrastCheck").checked;
  if (checked) {
    document.body.classList.add("contrast");
    localStorage.setItem("su_contrast", "on");
  } else {
    document.body.classList.remove("contrast");
    localStorage.setItem("su_contrast", "off");
  }
}

function toggleReducedMotion() {
  var checked = document.getElementById("motionCheck").checked;
  if (checked) {
    document.body.classList.add("no-motion");
    localStorage.setItem("su_motion", "reduced");
  } else {
    document.body.classList.remove("no-motion");
    localStorage.setItem("su_motion", "normal");
  }
}

function applySavedSettings() {
  var theme = localStorage.getItem("su_theme");
  if (theme === "dark") {
    document.body.classList.add("dark");
  }

  var fontSize = localStorage.getItem("su_fontsize");
  if (fontSize !== null) {
    document.body.style.fontSize = fontSize;
  }

  var contrast = localStorage.getItem("su_contrast");
  if (contrast === "on") {
    document.body.classList.add("contrast");
    document.getElementById("contrastCheck").checked = true;
  }

  var motion = localStorage.getItem("su_motion");
  if (motion === "reduced") {
    document.body.classList.add("no-motion");
    document.getElementById("motionCheck").checked = true;
  }

  var lang = localStorage.getItem("su_lang");
  if (lang !== null) {
    document.getElementById("langSelect").value = lang;
    setLanguage(lang);
  }
}

/* ----------------------------------------------
   LANGUAGE SWITCHER (English / Hindi / Kannada)
---------------------------------------------- */
var translations = {
  en: {
    navHome: "Home", navContacts: "Contacts", navGuide: "Safety Guide", navCheckin: "Check-in",
    navReport: "Report", navFb: "Feedback", navAn: "Insights",
    navPr: "Profile", heroTitle: "You're a tap away from help."
  },
  hi: {
    navHome: "होम", navContacts: "संपर्क", navGuide: "सुरक्षा गाइड", navCheckin: "चेक-इन",
    navReport: "रिपोर्ट", navFb: "प्रतिक्रिया", navAn: "जानकारी",
    navPr: "प्रोफ़ाइल", heroTitle: "मदद सिर्फ एक टैप दूर है।"
  },
  kn: {
    navHome: "ಮುಖಪುಟ", navContacts: "ಸಂಪರ್ಕಗಳು", navGuide: "ಸುರಕ್ಷತಾ ಮಾರ್ಗದರ್ಶಿ", navCheckin: "ಚೆಕ್-ಇನ್",
    navReport: "ವರದಿ", navFb: "ಪ್ರತಿಕ್ರಿಯೆ", navAn: "ಒಳನೋಟಗಳು",
    navPr: "ಪ್ರೊಫೈಲ್", heroTitle: "ಸಹಾಯ ಕೇವಲ ಒಂದು ಟ್ಯಾಪ್ ದೂರದಲ್ಲಿದೆ."
  }
};

function setLanguage(lang) {
  localStorage.setItem("su_lang", lang);
  document.documentElement.lang = lang;
  var t = translations[lang];
  var keys = Object.keys(t);
  var i;
  for (i = 0; i < keys.length; i++) {
    var el = document.getElementById(keys[i]);
    if (el !== null) {
      el.innerText = t[keys[i]];
    }
  }
}

/* ----------------------------------------------
   HELP CHATBOT
   ------------------------------------------------
   This is NOT connected to any AI service - it's a simple keyword
   matcher. It loops through a list of known topics, checks if the
   question typed contains any of that topic's keywords, and shows
   the matching pre-written answer. No internet or API key needed,
   so it also works offline.
---------------------------------------------- */
var chatbotStarted = false;

var FAQ_DATA = [
  {
    keywords: ["panic", "sos", "emergency button"],
    answer: "Panic Mode gives you one big screen with Security, Ambulance, Police and Fire call buttons, plus a big SOS button. Tapping SOS tries to get your location (only with your permission) and saves a timestamped record under Alert History in your Profile."
  },
  {
    keywords: ["contact", "call", "ambulance number", "police number"],
    answer: "Emergency Contacts shows Campus Security, Ambulance (108), Police (100/112), Fire (101) and your Student Counsellor, each with a tap-to-call button using a normal phone call - no internet needed."
  },
  {
    keywords: ["guide", "first aid", "harassment report", "fire emergency", "safety tips"],
    answer: "The Safety Guide has short offline instructions for first aid, harassment reporting, fire emergencies, and personal safety tips, plus a search box to jump to the section you need."
  },
  {
    keywords: ["checkin", "check-in", "mood", "feeling", "wellbeing"],
    answer: "Wellbeing Check-in lets you pick a mood (Happy, Calm, Stressed, Sad, Anxious) and add an optional private note. It's saved with localStorage, and your recent history shows right below the form."
  },
  {
    keywords: ["lost item", "found item", "lost and found"],
    answer: "Lost & Found isn't a separate page anymore - just pick \"Lost Item\" or \"Found Item\" as the type in Report an Issue. It'll ask for a contact number so someone can reach you about it."
  },
  {
    keywords: ["report", "issue", "theft", "ragging"],
    answer: "Report an Issue lets you log harassment, theft, hazards, medical emergencies, ragging, or lost/found items with a location, date, and description. It's saved on your device even if you're offline, and shown under \"My Reports\"."
  },
  {
    keywords: ["feedback", "anonymous"],
    answer: "Anonymous Feedback is a separate form that does NOT save your name or account - it's for reporting harassment or unsafe areas without being identified."
  },
  {
    keywords: ["insight", "analytics", "chart", "mood trend"],
    answer: "My Insights shows simple bar charts (built with plain HTML/CSS, no chart library) of your mood trend and the types of issues you've reported. It's private - only visible to you."
  },
  {
    keywords: ["alert history", "sos history"],
    answer: "Alert History (inside Profile) lists every time you prepared an SOS message - the time, and whether you allowed your location to be shared."
  },
  {
    keywords: ["profile", "blood group", "allergies", "accessibility", "font size", "erase data"],
    answer: "Profile stores your name, blood group, allergies and emergency contact - only on this device. It also has accessibility controls (text size, high contrast, reduced motion) and a button to erase all your data."
  },
  {
    keywords: ["share route", "leaving now"],
    answer: "Share My Route asks where you're heading, then opens your phone's share sheet with a \"leaving now\" message you can send to a trusted contact - or copies it if sharing isn't supported."
  },
  {
    keywords: ["login", "signup", "account", "gmail", "password", "logout"],
    answer: "Accounts require a Gmail address. Once you log in, you stay logged in automatically (the session is remembered) until you tap Logout - there's no repeated login needed."
  },
  {
    keywords: ["data", "localstorage", "privacy", "stored", "offline"],
    answer: "Everything you enter is cached locally for offline use. Reports and anonymous feedback can also sync securely to Firebase when Firebase is configured and you are signed in."
  },
  {
    keywords: ["google sheet", "sheet", "sync"],
    answer: "When Firebase is configured, reports and anonymous feedback are stored in Firestore and can be reviewed from the Firebase Admin panel."
  },
  {
    keywords: ["language", "hindi", "kannada"],
    answer: "You can switch the app between English, Hindi and Kannada using the dropdown in the top bar."
  },
  {
    keywords: ["install", "home screen", "pwa", "app"],
    answer: "SecureU is a Progressive Web App - use \"Add to Home Screen\" from your browser's menu to install it like a real app, including offline access via a service worker."
  },
  {
    keywords: ["dark mode", "theme", "color"],
    answer: "Tap the moon icon in the top bar to switch between light and dark mode - your choice is remembered for next time."
  }
];

function toggleChatbot() {
  var panel = document.getElementById("chatPanel");
  var isOpen = panel.style.display === "flex";

  if (isOpen) {
    panel.style.display = "none";
  } else {
    panel.style.display = "flex";
    if (chatbotStarted === false) {
      appendChatBubble("bot", "Hi! I'm the SecureU helper. Ask me what any feature does, or tap a quick question below.");
      chatbotStarted = true;
    }
  }
}

function appendChatBubble(sender, text) {
  var messages = document.getElementById("chatMessages");
  var bubble = document.createElement("div");
  bubble.className = "chatBubble " + sender;
  bubble.innerText = text;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
}

function findChatAnswer(question) {
  var lowerQuestion = question.toLowerCase();
  var i;
  var j;

  for (i = 0; i < FAQ_DATA.length; i++) {
    for (j = 0; j < FAQ_DATA[i].keywords.length; j++) {
      if (lowerQuestion.indexOf(FAQ_DATA[i].keywords[j]) !== -1) {
        return FAQ_DATA[i].answer;
      }
    }
  }

  return "I don't have an answer for that yet. Try asking about: panic mode, check-in, report an issue, lost and found, feedback, contacts, profile, or data privacy.";
}

function sendChatMessage() {
  var input = document.getElementById("chatInput");
  var question = input.value.trim();

  if (question === "") {
    return;
  }

  appendChatBubble("user", question);
  var answer = findChatAnswer(question);
  appendChatBubble("bot", answer);

  input.value = "";
}

function askChatbot(question) {
  document.getElementById("chatInput").value = question;
  sendChatMessage();
}


/* ==============================================================
   SMART CAMPUS COMPANION
   Imaginary college data for the ready-to-demo SecureU project.
   Replace these entries later with your real campus details.
============================================================== */
var CAMPUS_DATA = [
  {name:"Main Academic Block", type:"Building", floor:"Ground Floor", room:"", desc:"Main classrooms, faculty rooms and department offices", keywords:"academic block classrooms computer science"},
  {name:"Innovation Block", type:"Building", floor:"1st Floor", room:"", desc:"AI, robotics and computer laboratories", keywords:"innovation lab ai robotics computer"},
  {name:"Knowledge Block", type:"Building", floor:"2nd Floor", room:"204", desc:"Central Library and reading hall", keywords:"library reading hall books"},
  {name:"Administration Block", type:"Office", floor:"Ground Floor", room:"104", desc:"Exam Cell, Registrar and administrative offices", keywords:"admin exam cell registrar"},
  {name:"Student Services Block", type:"Office", floor:"Ground Floor", room:"108", desc:"ID card, student support and counselling desk", keywords:"student services id card counselling"},
  {name:"Student Plaza", type:"Facility", floor:"Ground Floor", room:"", desc:"Canteen, seating and student common area", keywords:"canteen food cafe common area"},
  {name:"Room 305", type:"Classroom", floor:"3rd Floor", building:"Main Academic Block", room:"305", desc:"BCA classroom - Data Structures", keywords:"data structures ds class"},
  {name:"Room 312", type:"Faculty Room", floor:"3rd Floor", building:"Main Academic Block", room:"312", desc:"Computer Science faculty room", keywords:"java teacher faculty cs"},
  {name:"Computer Lab 1", type:"Lab", floor:"1st Floor", building:"Innovation Block", room:"L-101", desc:"Programming and database practical lab", keywords:"java python programming lab"},
  {name:"AI Lab", type:"Lab", floor:"1st Floor", building:"Innovation Block", room:"L-102", desc:"Machine learning and AI practical lab", keywords:"ai ml machine learning"},
  {name:"Dr. Arjun Menon", type:"Faculty", department:"Computer Science", floor:"3rd Floor", building:"Main Academic Block", room:"312", desc:"Data Structures and Java faculty", keywords:"java data structures ds teacher"},
  {name:"Dr. Meera Nair", type:"Faculty", department:"Computer Science", floor:"3rd Floor", building:"Main Academic Block", room:"314", desc:"Python and Artificial Intelligence faculty", keywords:"python ai artificial intelligence teacher"},
  {name:"Prof. Rahul Das", type:"Faculty", department:"Student Affairs", floor:"Ground Floor", building:"Student Services Block", room:"108", desc:"Student support and guidance", keywords:"student help support guidance"},
  {name:"Dr. Sana Thomas", type:"HOD", department:"Computer Science", floor:"3rd Floor", building:"Main Academic Block", room:"320", desc:"Head of Department - Computer Science", keywords:"hod head department computer science"}
];

var SENIOR_TIPS = [
  {cat:"Academic", title:"Prepare for Java Viva", text:"Revise OOP concepts, constructors, inheritance and small programs. Practice explaining your code in simple words.", by:"Aarav • 3rd Year"},
  {cat:"Academic", title:"Lab Submission Tip", text:"Keep your program file, output screenshot and viva explanation together before lab day.", by:"Nisha • 2nd Year"},
  {cat:"Campus", title:"Find the Exam Cell", text:"Administration Block → Ground Floor → Room 104. Go early during exam-form deadlines.", by:"Rahul • 3rd Year"},
  {cat:"Campus", title:"Library Shortcut", text:"The Knowledge Block connects to the Main Academic Block through the covered walkway on the 2nd floor.", by:"Fathima • 3rd Year"},
  {cat:"Faculty", title:"Need Faculty Guidance?", text:"If you are unsure who handles a question, search the faculty name or use Where Should I Go? instead of walking around campus.", by:"Aditya • Final Year"},
  {cat:"Resources", title:"Useful Study Habit", text:"Keep one folder for unit notes, lab programs and previous questions. It makes revision much faster before internal exams.", by:"Sneha • 3rd Year"}
];

var campusHubFilter = "All";

function initCampusFeatures() {
  var locationSelect = document.getElementById("currentCampusLocation");
  if (!locationSelect) return;
  if (locationSelect.options.length === 1) {
    for (var i=0;i<CAMPUS_DATA.length;i++) {
      if (CAMPUS_DATA[i].type !== "Faculty") {
        var o=document.createElement("option"); o.value=i; o.textContent=CAMPUS_DATA[i].name + " — " + CAMPUS_DATA[i].floor; locationSelect.appendChild(o);
      }
    }
  }
  renderKnowledgeHub();
}

function searchCampus() {
  var input=(document.getElementById("campusSearch").value||"").trim().toLowerCase();
  var box=document.getElementById("campusResults"); if(!box)return;
  if(!input){box.innerHTML='<p class="emptyMsg">Start typing a place, room, faculty member or department.</p>';return;}
  var found=[];
  for(var i=0;i<CAMPUS_DATA.length;i++){
    var x=CAMPUS_DATA[i]; var hay=(x.name+" "+x.type+" "+(x.department||"")+" "+(x.floor||"")+" "+(x.room||"")+" "+(x.desc||"")+" "+(x.keywords||"")).toLowerCase();
    if(hay.indexOf(input)!==-1) found.push(x);
  }
  if(!found.length){box.innerHTML='<div class="campusResult emptyMsg">No matching campus location yet. Try “library”, “java”, “room 305” or “canteen”.</div>';return;}
  var html=""; for(var k=0;k<found.length;k++) html+=campusResultCard(found[k]); box.innerHTML=html;
}

function campusResultCard(x){
  return '<div class="campusResult"><div><strong>'+escapeText(x.name)+'</strong><span>'+escapeText(x.type)+(x.department?' • '+escapeText(x.department):'')+'</span><p>'+escapeText(x.desc||"")+'</p></div><div class="locationPill">📍 '+escapeText(x.building||x.name)+'<br>🏢 '+escapeText(x.floor||"")+(x.room?' • 🚪 '+escapeText(x.room):"")+'</div></div>';
}

function showNearbyCampus(){
  var v=document.getElementById("currentCampusLocation").value, box=document.getElementById("nearbyCampus"); if(!box)return;
  if(v===""){box.innerHTML="";return;} var x=CAMPUS_DATA[parseInt(v,10)];
  var nearby=[]; for(var i=0;i<CAMPUS_DATA.length;i++){var y=CAMPUS_DATA[i]; if(i!==parseInt(v,10) && ((y.building&&x.name.indexOf(y.building)!==-1)||(x.building&&y.building===x.building)||y.name===x.building)) nearby.push(y);}
  if(!nearby.length) nearby=CAMPUS_DATA.slice(0,4);
  var h='<strong>Nearby from '+escapeText(x.name)+':</strong><ul>'; for(var j=0;j<Math.min(5,nearby.length);j++) h+='<li>'+escapeText(nearby[j].name)+' — '+escapeText(nearby[j].floor||"")+(nearby[j].room?' / '+escapeText(nearby[j].room):"")+'</li>'; h+='</ul>'; box.innerHTML=h;
}

function smartGo(){
  var q=(document.getElementById("goRequest").value||"").toLowerCase().trim(), box=document.getElementById("goResult"); if(!box)return;
  if(!q){box.innerHTML='<p class="emptyMsg">Tell me what you need, for example “I need my Java teacher”.</p>';return;}
  var best=[], words=q.split(/\s+/);
  for(var i=0;i<CAMPUS_DATA.length;i++){var x=CAMPUS_DATA[i]; var hay=(x.name+" "+x.type+" "+(x.department||"")+" "+(x.desc||"")+" "+(x.keywords||"")).toLowerCase(); var score=0; for(var w=0;w<words.length;w++){if(words[w].length>2 && hay.indexOf(words[w])!==-1)score++;} if(score>0)best.push({x:x,score:score});}
  best.sort(function(a,b){return b.score-a.score;});
  if(!best.length){box.innerHTML='<p class="emptyMsg">Try “Java teacher”, “library”, “exam cell”, “HOD” or “canteen”.</p>';return;}
  box.innerHTML='<div class="smartAnswer"><span>🤖 SecureU suggests</span>'+campusResultCard(best[0].x)+'<button class="outlineBtn" onclick="showPage(\'page-campus\');document.getElementById(\'campusSearch\').value=\''+escapeJs(best[0].x.name)+'\';searchCampus();">Show in Campus Search</button></div>';
}
function escapeJs(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}



/* ================= ATTENDANCE + TIMETABLE ================= */
var STUDENT_DATA = {
  "BCA|1st Year|A": [
    {name:"Arjun Nair",id:"BCA1A01",att:[92,76,64,88,81], subjects:["Programming","Data Structures","DBMS","Computer Fundamentals","Web Development"], schedule:[["Programming","DBMS","Data Structures","Web Development","Computer Fundamentals"],["DBMS","Programming","Web Development","Data Structures","DBMS"],["Data Structures","Web Development","Programming","DBMS","Programming"],["Web Development","Computer Fundamentals","DBMS","Programming","Data Structures"],["Programming Lab","DBMS","Computer Fundamentals","Web Development Lab","Data Structures"]], daily:[1,1,0,1,1]},
    {name:"Meera Thomas",id:"BCA1A02",att:[84,91,78,69,94], subjects:["Programming","Data Structures","DBMS","Computer Fundamentals","Web Development"], schedule:[["Programming","DBMS","Data Structures","Web Development","Computer Fundamentals"],["DBMS","Programming","Web Development","Data Structures","DBMS"],["Data Structures","Web Development","Programming","DBMS","Programming"],["Web Development","Computer Fundamentals","DBMS","Programming","Data Structures"],["Programming Lab","DBMS","Computer Fundamentals","Web Development Lab","Data Structures"]], daily:[1,1,1,0,1]}
  ],
  "BCA|2nd Year|B": [
    {name:"Rahul Das",id:"BCA2B11",att:[73,86,91,67,79],subjects:["Java","Python","Computer Networks","Software Engineering","Operating Systems"],schedule:[["Java","Python","Networks","SE","OS"],["Python","Java Lab","OS","Networks","SE"],["Networks","SE","Java","OS Lab","Python"],["OS","Networks","Python","Java","SE"],["Java Lab","Python","Networks","SE","OS"]],daily:[0,1,1,0,1]},
    {name:"Aisha Khan",id:"BCA2B12",att:[88,72,83,94,61],subjects:["Java","Python","Computer Networks","Software Engineering","Operating Systems"],schedule:[["Java","Python","Networks","SE","OS"],["Python","Java Lab","OS","Networks","SE"],["Networks","SE","Java","OS Lab","Python"],["OS","Networks","Python","Java","SE"],["Java Lab","Python","Networks","SE","OS"]],daily:[1,0,1,1,0]}
  ],
  "BBA|1st Year|A": [
    {name:"Ananya Rao",id:"BBA1A01",att:[90,82,71,95,87],subjects:["Management","Marketing","Economics","Business Communication","Accounting"],schedule:[["Management","Marketing","Economics","Communication","Accounting"],["Marketing","Management","Accounting","Economics","Communication"],["Economics","Communication","Management","Marketing","Accounting"],["Accounting","Economics","Marketing","Management","Communication"],["Management","Marketing","Economics","Accounting","Communication"]],daily:[1,1,0,1,1]},
    {name:"Vishnu Menon",id:"BBA1A02",att:[68,79,92,74,88],subjects:["Management","Marketing","Economics","Business Communication","Accounting"],schedule:[["Management","Marketing","Economics","Communication","Accounting"],["Marketing","Management","Accounting","Economics","Communication"],["Economics","Communication","Management","Marketing","Accounting"],["Accounting","Economics","Marketing","Management","Communication"],["Management","Marketing","Economics","Accounting","Communication"]],daily:[0,1,1,0,1]}
  ],
  "B.Com|2nd Year|B": [
    {name:"Adil Ibrahim",id:"BCOM2B07",att:[96,74,82,63,89],subjects:["Financial Accounting","Business Law","Economics","Cost Accounting","Marketing"],schedule:[["Financial Accounting","Business Law","Economics","Cost Accounting","Marketing"],["Business Law","Financial Accounting","Marketing","Economics","Cost Accounting"],["Economics","Marketing","Financial Accounting","Business Law","Cost Accounting"],["Cost Accounting","Economics","Business Law","Marketing","Financial Accounting"],["Marketing","Cost Accounting","Economics","Financial Accounting","Business Law"]],daily:[1,0,1,0,1]},
    {name:"Neha Joseph",id:"BCOM2B08",att:[81,93,76,88,70],subjects:["Financial Accounting","Business Law","Economics","Cost Accounting","Marketing"],schedule:[["Financial Accounting","Business Law","Economics","Cost Accounting","Marketing"],["Business Law","Financial Accounting","Marketing","Economics","Cost Accounting"],["Economics","Marketing","Financial Accounting","Business Law","Cost Accounting"],["Cost Accounting","Economics","Business Law","Marketing","Financial Accounting"],["Marketing","Cost Accounting","Economics","Financial Accounting","Business Law"]],daily:[1,1,0,1,0]}
  ]
};
var ATT_FALLBACK={"BCA":["Programming","Data Structures","DBMS","Networks","Web Development"],"BBA":["Management","Marketing","Economics","Business Communication","Accounting"],"B.Com":["Financial Accounting","Business Law","Economics","Cost Accounting","Marketing"]};
function hashStudentSeed(value){
  var h=0, i;
  value=String(value||"");
  for(i=0;i<value.length;i++){h=((h<<5)-h)+value.charCodeAt(i);h=h&h;}
  return Math.abs(h);
}
function getLoggedInStudent(){
  var name=(currentUserName||"").trim();
  var lower=name.toLowerCase();
  var keys=Object.keys(STUDENT_DATA), i, j;
  for(i=0;i<keys.length;i++){
    var arr=STUDENT_DATA[keys[i]];
    for(j=0;j<arr.length;j++) if(String(arr[j].name).toLowerCase()===lower){
      return {data:JSON.parse(JSON.stringify(arr[j])),key:keys[i]};
    }
  }
  /* New Firebase users get a private virtual student record derived from their login.
     No other student's name or personal record is shown. */
  var seed=hashStudentSeed((currentUserEmail||"")+"|"+name);
  var key=keys[seed%keys.length], template=STUDENT_DATA[key][seed%STUDENT_DATA[key].length];
  var parts=key.split("|");
  var student=JSON.parse(JSON.stringify(template));
  student.name=name||"Student";
  student.id="SU-"+String(seed).slice(0,6).padStart(6,"0");
  for(i=0;i<student.att.length;i++) student.att[i]=Math.max(55,Math.min(98,student.att[i]+((seed+i*7)%13)-6));
  student.course=parts[0]; student.year=parts[1]; student.className=parts[2];
  return {data:student,key:key};
}
function getCurrentStudentRecord(){
  var found=getLoggedInStudent();
  var parts=found.key.split("|");
  found.data.course=parts[0]; found.data.year=parts[1]; found.data.className=parts[2];
  return found.data;
}
function buildWeeklyAttendance(student){
  var seed=hashStudentSeed(student.id||student.name), days=["Monday","Tuesday","Wednesday","Thursday","Friday"], out=[];
  for(var d=0;d<5;d++){
    var present=0,total=5;
    for(var h=0;h<5;h++){
      var subjectIndex=(d+h)%student.att.length, threshold=student.att[subjectIndex];
      var v=((seed+d*11+h*17)%100);
      if(v<threshold) present++;
    }
    var pct=Math.round((present/total)*100), cls=pct<60?"week-risk":pct<80?"week-warn":"week-safe";
    out.push({day:days[d],present:present,total:total,pct:pct,cls:cls});
  }
  return out;
}
function buildTodayClasses(student){
  var times=["9:00–10:00","10:00–11:00","11:15–12:15","12:15–1:15","2:00–3:00"], dayIndex=new Date().getDay()-1;
  if(dayIndex<0||dayIndex>4) dayIndex=0;
  var seed=hashStudentSeed(student.id||student.name), list=[];
  for(var h=0;h<5;h++){
    var subjectIndex=(dayIndex+h)%student.att.length, present=((seed+dayIndex*11+h*17)%100)<student.att[subjectIndex];
    list.push({time:times[h],subject:student.schedule[dayIndex][h],present:present});
  }
  return {day:["Monday","Tuesday","Wednesday","Thursday","Friday"][dayIndex],items:list};
}
function initAttendancePlanner(){renderAttendanceForLoggedInStudent();}
function updateAttendancePlanner(){renderAttendanceForLoggedInStudent();}
function renderAttendanceForLoggedInStudent(){
  var student=getCurrentStudentRecord();
  var nameBox=document.getElementById("loggedStudentName"), metaBox=document.getElementById("loggedStudentMeta");
  if(nameBox) nameBox.innerText=student.name;
  if(metaBox) metaBox.innerText=student.course+" • "+student.year+" • Class "+student.className+" • ID "+student.id;
  renderAttendanceStudent(student);
}
function renderAttendanceStudent(student){
  var course=student.course,year=student.year,cl=student.className;
  var avg=Math.round(student.att.reduce(function(a,b){return a+b;},0)/student.att.length), risk=avg<75?"High Risk":avg<85?"Warning":"Safe";
  document.getElementById("studentSummary").innerHTML='<div class="studentStat"><span>Student</span><strong>'+escapeText(student.name)+'</strong><small>'+escapeText(student.id)+'</small></div><div class="studentStat"><span>Course / Year / Class</span><strong>'+escapeText(course)+' • '+escapeText(year)+'</strong><small>Class '+escapeText(cl)+'</small></div><div class="studentStat"><span>Overall Attendance</span><strong class="countUp">'+avg+'%</strong><small class="risk-'+risk.toLowerCase().replace(' ','-')+'">'+risk+'</small></div>';
  var bars="";
  for(var i=0;i<student.subjects.length;i++){
    var v=student.att[i],status=v<75?"risk-high":v<85?"risk-warn":"risk-safe";
    bars+='<div class="attRow"><div class="attLabel"><span>'+escapeText(student.subjects[i])+'</span><b>'+v+'%</b></div><div class="attTrack"><span class="attFill '+status+'" style="--att:'+v+'%"></span></div><small>'+(v<75?'🔴 High risk — attend consistently':v<85?'🟡 Warning — attendance needs attention':'🟢 Safe — currently above target')+'</small></div>';
  }
  document.getElementById("attendanceBars").innerHTML=bars;
  var graph='<div class="graphBars">';
  for(var j=0;j<student.subjects.length;j++){var gv=student.att[j];graph+='<div class="graphCol"><div class="graphValue">'+gv+'%</div><div class="graphTrack"><div class="graphFill" style="height:'+Math.max(4,gv)+'%"></div></div><span>'+escapeText(student.subjects[j].split(' ')[0])+'</span></div>';}
  graph+='</div><div class="targetLine"><span>75% attendance target</span></div>'; document.getElementById("attendanceGraph").innerHTML=graph;
  var times=["9:00–10:00","10:00–11:00","11:15–12:15","12:15–1:15","2:00–3:00"], tb="";
  for(var r=0;r<times.length;r++){tb+='<tr><th>'+times[r]+'</th>';for(var d=0;d<5;d++)tb+='<td>'+escapeText(student.schedule[d][r])+'</td>';tb+='</tr>';}
  document.getElementById("timetableBody").innerHTML=tb; document.getElementById("timetableClassBadge").innerText=course+' • '+year+' • '+cl;
  var today=buildTodayClasses(student), dh='<div class="todayTitle">📍 '+today.day+' — Today\'s timetable</div>';
  for(var q=0;q<today.items.length;q++){var item=today.items[q];dh+='<div class="dailyClass '+(item.present?'present':'absent')+'"><span>'+item.time+'</span><strong>'+escapeText(item.subject)+'</strong><b>'+(item.present?'✓ Present':'✕ Absent')+'</b></div>';}
  document.getElementById("dailyAttendance").innerHTML=dh;
  var weekly=buildWeeklyAttendance(student), wh="";
  for(var w=0;w<weekly.length;w++){var x=weekly[w];wh+='<div class="weeklyDayCard '+x.cls+'"><div class="dayName">'+x.day+'</div><div class="dayPct">'+x.pct+'%</div><small>'+x.present+' / '+x.total+' classes present</small></div>';}
  document.getElementById("weeklyAttendance").innerHTML=wh;
  showTimetableView("week");
}
function showTimetableView(view){
  var week=document.getElementById("weeklyTimetableView"), today=document.getElementById("todayTimetableView"), wb=document.getElementById("weekTabBtn"), tb=document.getElementById("todayTabBtn");
  if(!week||!today)return;
  if(view==="today"){week.style.display="none";today.style.display="block";if(wb)wb.classList.remove("active");if(tb)tb.classList.add("active");}
  else{week.style.display="block";today.style.display="none";if(tb)tb.classList.remove("active");if(wb)wb.classList.add("active");}
}

function renderKnowledgeHub(){
  var box=document.getElementById("knowledgeHubList"); if(!box)return; var h="";
  for(var i=0;i<SENIOR_TIPS.length;i++){var t=SENIOR_TIPS[i];if(campusHubFilter!=="All"&&t.cat!==campusHubFilter)continue;h+='<article class="knowledgeCard"><span class="tipTag">'+escapeText(t.cat)+'</span><h4>'+escapeText(t.title)+'</h4><p>'+escapeText(t.text)+'</p><small>💬 '+escapeText(t.by)+'</small><button onclick="markHelpful(this)">♡ Helpful</button></article>';}
  box.innerHTML=h||'<p class="emptyMsg">No tips in this category yet.</p>';
}

function addSeniorTip(){
  var title=(document.getElementById("seniorTipTitle").value||"").trim();
  var text=(document.getElementById("seniorTipText").value||"").trim();
  var cat=document.getElementById("seniorTipCategory").value;
  if(!title||!text){ alert("Please enter a title and tip."); return; }
  SENIOR_TIPS.push({cat:cat,title:title,text:text,by:"SecureU Student • Shared Tip"});
  renderKnowledgeHub();
  document.getElementById("seniorTipTitle").value="";
  document.getElementById("seniorTipText").value="";
  alert("Tip added to the Senior Knowledge Hub.");
}

function filterHub(cat,btn){campusHubFilter=cat;var bs=document.getElementsByClassName("miniFilter");for(var i=0;i<bs.length;i++)bs[i].classList.remove("active");btn.classList.add("active");renderKnowledgeHub();}
function markHelpful(btn){btn.innerText="✓ Helpful";btn.disabled=true;}

function newStudentAction(kind){
  var box=document.getElementById("newStudentResult"); if(!box)return; var h="";
  if(kind==='places') h='<strong>🗺️ Your first places</strong><p>Start with the Library in Knowledge Block, your department in Main Academic Block, and Student Services Block for ID-card or support questions.</p>';
  if(kind==='faculty') h='<strong>👨‍🏫 Find your teacher</strong><p>Use Smart Search or type “I need my Java teacher” in Where Should I Go? SecureU will show the faculty room.</p>';
  if(kind==='rules') h='<strong>📋 Campus basics</strong><ul><li>Carry your student ID.</li><li>Use labs only during permitted hours.</li><li>Keep emergency contacts accessible.</li><li>Report safety concerns through SecureU.</li></ul>';
  if(kind==='week') h='<strong>🎒 First-week checklist</strong><ul><li>Locate your classroom.</li><li>Find your department and faculty rooms.</li><li>Visit the library.</li><li>Locate the Exam Cell and Student Services.</li><li>Save emergency contacts.</li></ul>';
  if(kind==='help') h='<strong>❓ Ask SecureU</strong><p>Examples: “Where is the exam cell?”, “Where is the library?”, “Who is my Java teacher?” or “Where is the canteen?”</p>';
  if(kind==='emergency') h='<strong>🆘 Emergency help</strong><p>Use the SOS button in the top navigation for Security, Ambulance, Police and Fire.</p>';
  box.innerHTML=h;
}
