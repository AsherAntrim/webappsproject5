var globalPlanID;
var globalUserID;
var globalMajorID;
var catalogData;
var plannedCourses;
var globalRequriementsData;

function fetchPlanData() {
  return $.ajax({
    url: "PHP/getCombined.php",
    type: "GET",
    dataType: "json",
  });
}

function fetchRequirementsData() {
  return $.ajax({
    url: "PHP/getRequirements.php",
    type: "GET",
    dataType: "json",
  });
}

function fetchCatalogData() {
  return $.ajax({
    url: "PHP/getCatalog.php",
    type: "GET",
    dataType: "json",
  });
}

function fetchPlannedCourses() {
  return $.ajax({
    url: "PHP/getPlannedCourses.php",
    type: "GET",
    dataType: "json",
  });
}

$(document).ready(function () {
  if (globalUserID !== null) {
    fetchRequirementsData().then(requirementsData => {
      globalRequriementsData = requirementsData;
      populateRequirements(requirementsData);
    }).catch(error => {
      console.error("Error fetching requirements data:", error);
    });

    fetchCatalogData().then(fetchedCatalogData => {
      catalogData = fetchedCatalogData;
      populateCatalog(catalogData);
      initializeCatalogSearch(catalogData);
    }).catch(error => {
      console.error("Error fetching catalog data:", error);
    });

    fetchPlanData().then(planData => {
      updateSiteHeader(planData);
      updateMajorSpecificData(planData);
      updateSemesterYears(planData);
    }).catch(error => {
      console.error("Error fetching plan data:", error);
    });

    fetchPlannedCourses().then(fetchedPlannedCourses => {
      plannedCourses = fetchedPlannedCourses;
      const organizedCourses = organizeCoursesByYearAndTerm(plannedCourses.planned_courses, catalogData);
      populateTermsWithCourses(organizedCourses);
    }).catch(error => {
      console.error("Error fetching planned courses data:", error);
    });
  } else {
    console.log("User is not logged in.");
  }
});

function updateSiteHeader(planData) {
  const { user_info, acc_plan, acc_major } = planData;

  const loggedInUserInfo = user_info.find(
    (user) => user.User_ID === globalUserID
  );

  if (!loggedInUserInfo) {
    return;
  }

  const siteHeader = document.querySelector(".site-header");

  const majorSelect = document.createElement("select");
  majorSelect.setAttribute("id", "majorSelect");
  majorSelect.classList.add("select-dropdown");
  acc_major.forEach((major) => {
    const option = document.createElement("option");
    option.value = major.major_id;
    option.text = `${major.major_name} (${major.type})`;
    majorSelect.appendChild(option);
    if (major.major_id === loggedInUserInfo.Major_ID) {
      option.selected = true;
      globalMajorID = major.major_id;
    }
  });
  siteHeader.appendChild(majorSelect);

  const planSelect = document.createElement("select");
  planSelect.setAttribute("id", "planSelect");
  planSelect.classList.add("select-dropdown");
  siteHeader.appendChild(planSelect);

  function populatePlans(majorID, userID) {
    while (planSelect.firstChild) planSelect.removeChild(planSelect.firstChild);
    const relevantPlans = acc_plan.filter(
      (plan) => plan.major_id === majorID && plan.user_id === userID
    );
    relevantPlans.forEach((plan) => {
      const option = document.createElement("option");
      option.value = plan.plan_id;
      option.text = plan.plan_name.trim();
      planSelect.appendChild(option);
    });
    if (relevantPlans.length > 0) {
      globalPlanID = relevantPlans[0].plan_id;
      planSelect.value = globalPlanID;
    }
    fetchPlannedCourses().then((plannedCourses) => {
      const organizedCourses = organizeCoursesByYearAndTerm(
        plannedCourses.planned_courses,
        catalogData
      );
      populateTermsWithCourses(organizedCourses);
    });
  }

  majorSelect.addEventListener("change", function () {
    globalMajorID = parseInt(this.value);
    populatePlans(globalMajorID, globalUserID);
    updateMajorSpecificData(planData);
    fetchPlannedCourses().then((plannedCourses) => {
      const organizedCourses = organizeCoursesByYearAndTerm(
        plannedCourses.planned_courses,
        catalogData
      );
      populateTermsWithCourses(organizedCourses);
    });
    updateRequirementsForSelectedPlan(globalPlanID);
  });

  planSelect.addEventListener("change", function () {
    globalPlanID = parseInt(this.value);
    updateRequirementsForSelectedPlan(globalPlanID);
    fetchPlannedCourses().then((plannedCourses) => {
      const organizedCourses = organizeCoursesByYearAndTerm(
        plannedCourses.planned_courses,
        catalogData
      );
      populateTermsWithCourses(organizedCourses);
    });
    const coursesContainers = document.querySelectorAll(".courses-container");
    coursesContainers.forEach((container) => {
      container.innerHTML = "";
    });
  });

  populatePlans(globalMajorID);
}

function updateGlobalPlanID() {
  globalPlanID = parseInt(this.value);
}

function updateMajorSpecificData(planData) {
  const acc_major = planData.acc_major;
  const selectedMajor = acc_major.find(
    (major) => major.major_id === globalMajorID
  );

  const userSpecificInfo = planData.user_info.find(
    (info) => info.User_ID === globalUserID
  );
  if (!userSpecificInfo) {
    console.error("User specific information not found.");
    return;
  }

  const { Catalog_Year, Student_Name, Current_Semester } = userSpecificInfo;
  const Major_Name = selectedMajor ? selectedMajor.major_name : "Unknown";

  const siteHeader = document.querySelector(".site-header");

  siteHeader
    .querySelectorAll(".info-label, .info-value")
    .forEach((el) => el.remove());

  const headerContent = document.createElement("div");
  headerContent.innerHTML = `
      <span class="info-label">Student Name:</span> <span class="info-value">${Student_Name}</span>
      <span class="info-label">Major:</span> <span class="info-value">${Major_Name}</span>
      <span class="info-label">Catalog Year:</span> <span class="info-value">${Catalog_Year}</span>
      <span class="info-label">Current Semester:</span> <span class="info-value">${Current_Semester}</span>
  `;

  siteHeader.appendChild(headerContent);

  updateSemesterYears(Catalog_Year);
}

function populateCatalog(courseData, sortField = "", sortOrder = "asc") {
  const catalogContainer = document.querySelector(".catalog");
  catalogContainer.innerHTML = "";
  const table = document.createElement("table");
  table.setAttribute("id", "catalogTable");
  table.classList.add("catalog-table");

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const headers = ["Course ID", "Course Name", "Credits", "Description"];
  headers.forEach((headerText) => {
    const header = document.createElement("th");
    header.textContent = headerText;
    header.setAttribute(
      "data-field",
      headerText.replace(/\s+/g, "_").toLowerCase()
    );
    header.addEventListener("click", () => {
      sortCatalog(courseData, header.getAttribute("data-field"));
    });
    headerRow.appendChild(header);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  if (sortField) {
    courseData.sort((a, b) => {
      const fieldA = a[sortField];
      const fieldB = b[sortField];
      if (fieldA < fieldB) return sortOrder === "asc" ? -1 : 1;
      if (fieldA > fieldB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }

  courseData.forEach((course) => {
    const row = document.createElement("tr");
    row.innerHTML = `
          <td>${course.course_id}</td>
          <td>${course.course_name}</td>
          <td>${course.credits}</td>
          <td>${course.description}</td>
      `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  catalogContainer.appendChild(table);
}

let currentSortField = "";
let currentSortOrder = "asc";

function sortCatalog(courseData, field) {
  if (currentSortField === field) {
    currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
  } else {
    currentSortField = field;
    currentSortOrder = "asc";
  }
  populateCatalog(courseData, currentSortField, currentSortOrder);
}

function updateRequirementsForSelectedPlan(selectedPlanId) {
  populateRequirements(globalRequriementsData);
}

function populateRequirements(data) {
  const requirementsContainer = document.querySelector(".TL");

  if ($(requirementsContainer).hasClass("ui-accordion")) {
    $(requirementsContainer).accordion("destroy");
  }
  $(requirementsContainer).empty();

  if (!data || !data.plans) {
    console.error("Expected an object with plans, but received:", data);
    return;
  }

  const accordionDiv = $("<div></div>");
  Object.keys(data.plans).forEach((type) => {
    const plan = data.plans[type];
    const header = $("<h3></h3>").text(`${type}`);
    const contentDiv = $("<div></div>");

    plan.courses.forEach((course) => {
      const courseName = course.course_name
        ? course.course_name
        : "Unknown Course";
      if (course.plan_id == globalPlanID) {
        contentDiv.append(`<p>${course.course_id} - ${courseName}</p>`);
      }
    });

    accordionDiv.append(header);
    accordionDiv.append(contentDiv);
  });

  $(requirementsContainer).append(accordionDiv);
  $(accordionDiv).accordion();
}

function initializeCatalogSearch(courseData) {
  const searchInput = document.getElementById("catalogSearch");

  searchInput.addEventListener("keyup", function () {
    const searchQuery = searchInput.value.toLowerCase();
    const filteredData = courseData.filter((course) => {
      return (
        course.course_id.toLowerCase().includes(searchQuery) ||
        course.course_name.toLowerCase().includes(searchQuery) ||
        course.credits.toString().toLowerCase().includes(searchQuery) ||
        course.description.toLowerCase().includes(searchQuery)
      );
    });
    populateCatalog(filteredData);
  });
}

function updateSemesterYears(plan) {
  if (plan && plan.user_info && plan.user_info.length > 0) {
    const startYear = parseInt(plan.user_info[0].Catalog_Year);

    const semesterElements = document.querySelectorAll(".semester");
    let year = startYear;

    semesterElements.forEach((element, index) => {
      const isYearAppended = /\d{4}$/.test(element.textContent.trim());
      const semesterText = element.textContent.trim().split(" ")[0];

      if (!isYearAppended) {
        if (semesterText.toLowerCase() === "fall") {
          element.textContent = `${semesterText} ${year}`;
        } else {
          if (
            index > 0 &&
            semesterElements[index - 1].textContent.includes("Fall")
          ) {
            year++;
          }
          element.textContent = `${semesterText} ${year}`;
        }
      }
    });
  }
}

function organizeCoursesByYearAndTerm(plannedCourses, catalogData) {
  const courseCatalog = {};
  catalogData.forEach((course) => {
    courseCatalog[course.course_id] = {
      Course_Name: course.course_name,
      Credits: course.credits,
      Description: course.description,
    };
  });

  return plannedCourses.reduce((years, course) => {
    if (course.Plan_ID === globalPlanID) {
      const year = course.Year;
      const term = course.Semester;
      const courseKey = course.Course_ID;
      if (!years[year]) years[year] = {};
      if (!years[year][term]) years[year][term] = [];
      const courseDetails = courseCatalog[courseKey];
      if (courseDetails) {
        years[year][term].push({
          Plan_ID: course.Plan_ID,
          courseDesignator: courseKey,
          courseName: courseDetails.Course_Name,
          credits: courseDetails.Credits,
          description: courseDetails.Description,
        });
      }
    }
    return years;
  }, {});
}

function populateTermsWithCourses(organizedCourses) {
  let totalCreditsAllTerms = 0;

  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => {
    const coursesContainer = cell.querySelector(".courses-container");
    while (coursesContainer.firstChild) {
      coursesContainer.removeChild(coursesContainer.firstChild);
    }
    const totalCreditsElement = cell.querySelector(".total-credits-term");
    if (totalCreditsElement) {
      totalCreditsElement.innerHTML = "Total Credits: <strong>0</strong>";
    } else {
      const newTotalCreditsElement = document.createElement("div");
      newTotalCreditsElement.classList.add("total-credits-term");
      newTotalCreditsElement.innerHTML = "Total Credits: <strong>0</strong>";
      cell.querySelector(".title").appendChild(newTotalCreditsElement);
    }
  });

  Object.keys(organizedCourses).forEach((year) => {
    Object.keys(organizedCourses[year]).forEach((term) => {
      const termDisplayName = `${term} ${year}`;
      let totalCreditsTerm = 0;
      cells.forEach((cell) => {
        const cellTitle = cell.querySelector(".title .semester");
        if (cellTitle && cellTitle.textContent.trim() === termDisplayName) {
          const coursesContainer = cell.querySelector(".courses-container");
          organizedCourses[year][term].forEach((course) => {
            if (course.Plan_ID === globalPlanID) {
              const courseListing = createCourseListing(course);
              coursesContainer.appendChild(courseListing);
              totalCreditsTerm += parseFloat(course.credits);
            }
          });
          const totalCreditsContainer = cell.querySelector(
            ".total-credits-term"
          );
          totalCreditsContainer.innerHTML = `Total Credits: <strong>${totalCreditsTerm}</strong>`;
          totalCreditsAllTerms += totalCreditsTerm;
        }
      });
    });
  });

  const totalCreditsId = "total-credits-all";
  let totalCreditsElement = document.getElementById(totalCreditsId);
  if (!totalCreditsElement) {
    totalCreditsElement = document.createElement("div");
    totalCreditsElement.id = totalCreditsId;
    totalCreditsElement.classList.add("total-credits-all-terms");
    document.querySelector(".site-header").appendChild(totalCreditsElement);
  }
  totalCreditsElement.innerHTML = `Total Credits for All Terms: <strong>${totalCreditsAllTerms}</strong>`;
}

function createCourseListing(course) {
  const listingDiv = document.createElement("div");
  listingDiv.classList.add("course-listing");

  const designatorSpan = document.createElement("span");
  designatorSpan.classList.add("designator");
  designatorSpan.textContent = course.courseDesignator;

  const nameSpan = document.createElement("span");
  nameSpan.classList.add("name");
  nameSpan.textContent = ` - ${course.courseName}`;

  listingDiv.appendChild(designatorSpan);
  listingDiv.appendChild(nameSpan);

  return listingDiv;
}
