document.addEventListener("DOMContentLoaded", () => {
  const monthPicker = document.getElementById("monthPicker");
  const yearPicker = document.getElementById("yearPicker");
  const todayButton = document.getElementById("todayButton");
  const colorPicker = window.ColorPicker;

  // New-selection drag state (click-drag across empty days to create a range).
  let isDragging = false;
  let selectionStart = null;
  let selectionEnd = null;
  let firstCell = null;
  let savedRanges = [];

  // Undo/redo history. `past`/`future` hold deep-cloned snapshots of
  // savedRanges; `baseline` is a clone of the current committed state, used so
  // each new mutation records the state that preceded it.
  const history = {
    past: [],
    future: [],
    baseline: [],
    limit: 50,
  };

  const cloneRanges = (ranges) => JSON.parse(JSON.stringify(ranges));

  // Existing-range manipulation state. `mode` is null when idle, "move" while
  // option-dragging a whole range, or "resize" while dragging a corner handle.
  const rangeDrag = {
    mode: null,
    rangeId: null,
    startDate: null,
    endDate: null,
    startDay: null,
    resizeEdge: null,
    pendingStart: null,
    pendingEnd: null,
  };

  function resetRangeDrag() {
    rangeDrag.mode = null;
    rangeDrag.rangeId = null;
    rangeDrag.startDate = null;
    rangeDrag.endDate = null;
    rangeDrag.startDay = null;
    rangeDrag.resizeEdge = null;
    rangeDrag.pendingStart = null;
    rangeDrag.pendingEnd = null;
  }

  // Persist the pending move/resize if it still overlaps the visible month,
  // then clear preview + state. Shared by the move and resize paths.
  function commitRangeDrag() {
    const { rangeId, pendingStart, pendingEnd } = rangeDrag;
    if (rangeId && pendingStart && pendingEnd && isRangeOverlappingMonth(pendingStart, pendingEnd)) {
      savedRanges = savedRanges.map(range => {
        if (range.id !== rangeId) return range;
        return {
          ...range,
          startDate: pendingStart.toISOString(),
          endDate: pendingEnd.toISOString()
        };
      });
      updateRangesAndUI();
    }
    clearDragPreview();
    resetRangeDrag();
  }

  const SCHEMA_VERSION = 1;

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const DateRange = {
    create: function(startDate, endDate, label, color, note) {
      // Set time to midnight for start and 23:59:59.999 for end
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      return {
        id: generateId(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        label: label,
        note: note || "",
        color: color || this.getDistinctHueColor()
      };
    },

    hasOverlap: function(range1, range2) {
      const start1 = new Date(range1.startDate);
      const end1 = new Date(range1.endDate);
      const start2 = new Date(range2.startDate);
      const end2 = new Date(range2.endDate);

      return start1 <= end2 && start2 <= end1;
    },

    getDistinctHueColor: function() {
      const selectedMonth = parseInt(monthPicker.value, 10);
      const selectedYear = parseInt(yearPicker.value, 10);
      return colorPicker.pickDistinctHueForMonth(savedRanges, selectedYear, selectedMonth);
    },
  };

  // Load saved ranges from localStorage
  function loadSavedRanges() {
    const saved = localStorage.getItem('calendarRanges');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        savedRanges = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Failed to parse saved ranges; starting empty.', e);
        savedRanges = [];
      }
    }
  }

  // Save ranges to localStorage
  function saveRanges() {
    localStorage.setItem('calendarRanges', JSON.stringify(savedRanges));
  }

  // Load saved ranges on startup
  loadSavedRanges();

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  for (let i = 0; i < months.length; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = months[i];
    monthPicker.appendChild(option);
  }

  for (let i = currentYear - 1; i <= currentYear + 5; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = i;
    yearPicker.appendChild(option);
  }

  monthPicker.value = currentMonth;
  yearPicker.value = currentYear;

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  const getFirstDayOfMonth = (year, month) => {
    const firstDay = new Date(year, month, 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  const getMonthNameAndYear = (year, month) => {
    const date = new Date(year, month);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  };

  function createCalendarDay(day, year, month) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    if (day !== null) {
      const dayNumber = document.createElement("div");
      dayNumber.className = "day-number";
      dayNumber.textContent = day;
      cell.appendChild(dayNumber);

      const labelsContainer = document.createElement("div");
      labelsContainer.className = "day-labels";
      cell.appendChild(labelsContainer);

      const dayCount = document.createElement("div");
      dayCount.className = "selection-count";
      cell.appendChild(dayCount);

      cell.setAttribute("data-day", day);
      cell.setAttribute("data-year", year);
      cell.setAttribute("data-month", month);
    }
    return cell;
  }

  function createLabelInput(start, end, initialLabel = "", modalTitle = "Add Label for Selected Range", initialNote = "") {
    const modal = document.createElement("div");
    modal.className = "label-modal";

    const selectedMonth = parseInt(monthPicker.value);
    const selectedYear = parseInt(yearPicker.value);
    const startDate = start instanceof Date
      ? new Date(start)
      : new Date(selectedYear, selectedMonth, parseInt(start));
    const endDate = end instanceof Date
      ? new Date(end)
      : new Date(selectedYear, selectedMonth, parseInt(end));

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    const duration = getRangeDurationDays(startDate, endDate);

    modal.innerHTML = `
      <div class="label-modal-content">
        <h3></h3>
        <div class="date-controls">
          <div class="dates-container">
            <div class="date-row">
              <div class="date-label">Start:</div>
              <input type="date" id="rangeStart" class="date-input">
            </div>
            <div class="date-row">
              <div class="date-label">End:</div>
              <div class="date-value">${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
          <div class="duration-control">
            <label>Duration:</label>
            <input type="number"
                  id="rangeDuration"
                  value="${duration}"
                  min="1"
                  class="duration-input">
            <span>days</span>
          </div>
        </div>
        <input type="text" id="rangeLabel" placeholder="Enter label" class="range-label-input">
        <textarea id="rangeNote" placeholder="Notes (optional)" class="range-note-input" rows="3"></textarea>
        <div class="modal-buttons">
          <button id="saveLabelBtn" class="primary-button">Save</button>
          <button id="cancelLabelBtn" class="secondary-button">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Assign user-controlled text via the DOM (not innerHTML) to avoid injection.
    modal.querySelector("h3").textContent = modalTitle;

    const input = modal.querySelector("#rangeLabel");
    input.value = initialLabel;
    const noteInput = modal.querySelector("#rangeNote");
    noteInput.value = initialNote;
    const startInput = modal.querySelector("#rangeStart");
    startInput.value = toDateInputValue(startDate);
    const durationInput = modal.querySelector("#rangeDuration");
    const saveBtn = modal.querySelector("#saveLabelBtn");
    const cancelBtn = modal.querySelector("#cancelLabelBtn");
    const endDateValue = modal.querySelector(".date-row:nth-child(2) .date-value");

    // End is derived from Start + Duration; recompute it whenever either changes.
    const syncEndFromStartAndDuration = () => {
      const days = parseInt(durationInput.value, 10) || 1;
      const newEndDate = new Date(startDate);
      newEndDate.setDate(startDate.getDate() + days - 1);
      newEndDate.setHours(23, 59, 59, 999);
      endDate.setTime(newEndDate.getTime());

      endDateValue.textContent = newEndDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric'
      });
    };

    startInput.addEventListener("change", () => {
      const newStart = parseDateInputValue(startInput.value);
      if (!newStart) {
        // Ignore an empty/invalid value and restore the last good date.
        startInput.value = toDateInputValue(startDate);
        return;
      }
      startDate.setTime(newStart.getTime());
      syncEndFromStartAndDuration();
    });

    durationInput.addEventListener("input", syncEndFromStartAndDuration);

    return new Promise((resolve, reject) => {
      saveBtn.addEventListener("click", () => {
        const label = input.value.trim();
        if (label) {
          modal.remove();
          resolve({
            label,
            note: noteInput.value.trim(),
            startDate,
            endDate
          });
        }
      });

      cancelBtn.addEventListener("click", () => {
        modal.remove();
        reject();
      });

      input.addEventListener("keyup", (e) => {
        if (e.key === "Enter" && input.value.trim()) {
          modal.remove();
          resolve({
            label: input.value.trim(),
            note: noteInput.value.trim(),
            startDate,
            endDate
          });
        } else if (e.key === "Escape") {
          modal.remove();
          reject();
        }
      });

      input.focus();
    });
  }

  function findMatchingRanges(cellDate) {
    const ranges = savedRanges.filter(range => {
      const startDate = new Date(range.startDate);
      const endDate = new Date(range.endDate);
      return cellDate >= startDate && cellDate <= endDate;
    });
    return ranges;
  }

  function getCurrentMonthBounds() {
    const selectedMonth = parseInt(monthPicker.value, 10);
    const selectedYear = parseInt(yearPicker.value, 10);
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    return { monthStart, monthEnd, selectedMonth, selectedYear };
  }

  function isRangeOverlappingMonth(startDate, endDate) {
    const { monthStart, monthEnd } = getCurrentMonthBounds();
    return startDate <= monthEnd && endDate >= monthStart;
  }

  // Format/parse a Date as a local YYYY-MM-DD string for <input type="date">.
  // Avoids the UTC shift you'd get from toISOString()/new Date("YYYY-MM-DD").
  function toDateInputValue(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDateInputValue(value) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!parts) return null;
    const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function getRangeDurationDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  }

  function clearDragPreview() {
    document.querySelectorAll("#selectedMonth .drag-preview").forEach(cell => {
      cell.classList.remove("drag-preview");
    });
  }

  function clearResizeHint() {
    document.querySelectorAll("#selectedMonth .resize-hint").forEach(cell => {
      cell.classList.remove("resize-hint");
    });
  }

  function updateDragPreview(startDate, endDate) {
    clearDragPreview();
    const { selectedMonth, selectedYear } = getCurrentMonthBounds();
    const start = new Date(startDate);
    const end = new Date(endDate);

    document.querySelectorAll("#selectedMonth .calendar-day").forEach((dayCell) => {
      const day = parseInt(dayCell.dataset.day, 10);
      if (!day) return;

      const cellDate = new Date(selectedYear, selectedMonth, day);
      cellDate.setHours(12, 0, 0, 0);

      if (cellDate >= start && cellDate <= end) {
        dayCell.classList.add("drag-preview");
      }
    });
  }

  function addRangeIdToCell(dayCell, rangeId) {
    const existing = dayCell.dataset.rangeIds
      ? dayCell.dataset.rangeIds.split(",")
      : [];
    if (!existing.includes(rangeId)) {
      existing.push(rangeId);
      dayCell.dataset.rangeIds = existing.join(",");
    }
  }

  function setRangeHover(rangeId, isActive) {
    document.querySelectorAll("#selectedMonth .calendar-day").forEach((dayCell) => {
      const ids = dayCell.dataset.rangeIds ? dayCell.dataset.rangeIds.split(",") : [];
      if (ids.includes(rangeId)) {
        dayCell.classList.toggle("range-hover", isActive);
      }
    });
  }

  function setRangeHandleDragState(range, edge, startCell) {
    rangeDrag.mode = "resize";
    rangeDrag.resizeEdge = edge;
    rangeDrag.rangeId = range.id;
    rangeDrag.startDay = parseInt(startCell.dataset.day, 10);
    rangeDrag.startDate = new Date(range.startDate);
    rangeDrag.endDate = new Date(range.endDate);
    rangeDrag.pendingStart = null;
    rangeDrag.pendingEnd = null;
  }

  function getCornerHitType(dayCell, clientX, clientY) {
    const rect = dayCell.getBoundingClientRect();
    const cornerSize = 12;
    const inLeft = clientX - rect.left <= cornerSize;
    const inRight = rect.right - clientX <= cornerSize;
    const inTop = clientY - rect.top <= cornerSize;
    const inBottom = rect.bottom - clientY <= cornerSize;

    if (dayCell.classList.contains("range-start") && inLeft && inTop) {
      return "start";
    }
    if (dayCell.classList.contains("range-end") && inRight && inBottom) {
      return "end";
    }
    return null;
  }

  function updateRangeResizePreview(hoverDay) {
    const { selectedMonth, selectedYear } = getCurrentMonthBounds();
    if (!Number.isFinite(hoverDay)) return;

    let newStart = new Date(rangeDrag.startDate);
    let newEnd = new Date(rangeDrag.endDate);

    if (rangeDrag.resizeEdge === "start") {
      newStart = new Date(selectedYear, selectedMonth, hoverDay);
      newStart.setHours(0, 0, 0, 0);
      if (newStart > newEnd) {
        newStart = new Date(newEnd);
        newStart.setHours(0, 0, 0, 0);
      }
    } else if (rangeDrag.resizeEdge === "end") {
      newEnd = new Date(selectedYear, selectedMonth, hoverDay);
      newEnd.setHours(23, 59, 59, 999);
      if (newEnd < newStart) {
        newEnd = new Date(newStart);
        newEnd.setHours(23, 59, 59, 999);
      }
    }

    if (isRangeOverlappingMonth(newStart, newEnd)) {
      rangeDrag.pendingStart = newStart;
      rangeDrag.pendingEnd = newEnd;
      updateDragPreview(newStart, newEnd);
    } else {
      rangeDrag.pendingStart = null;
      rangeDrag.pendingEnd = null;
      clearDragPreview();
    }
  }

  // Create a shared function for applying range styling
  function applyRangeStyling(dayCell, matchingRanges, isSmallMonth = false) {
    const isMultiRange = matchingRanges.length > 1;
    matchingRanges.forEach(range => addRangeIdToCell(dayCell, range.id));
    if (matchingRanges.length > 1) {
      const count = matchingRanges.length;
      const bands = matchingRanges.map((range, i) => {
        const start = (i / count) * 100;
        const end = ((i + 1) / count) * 100;
        return `${range.color} ${start}% ${end}%`;
      });
      dayCell.style.background = `linear-gradient(to bottom, ${bands.join(', ')})`;
    } else if (matchingRanges.length === 1) {
      dayCell.style.backgroundColor = matchingRanges[0].color;
    }

    const year = parseInt(dayCell.dataset.year);
    const month = parseInt(dayCell.dataset.month);
    const day = parseInt(dayCell.dataset.day);

    matchingRanges.forEach(range => {
      const startDate = new Date(range.startDate);
      const endDate = new Date(range.endDate);

      const isStart = startDate.getDate() === day &&
                     startDate.getMonth() === month &&
                     startDate.getFullYear() === year;
      const isEnd = endDate.getDate() === day &&
                   endDate.getMonth() === month &&
                   endDate.getFullYear() === year;

      if (isStart) {
        dayCell.classList.add('range-start');

        // Add label for range start in both main and small months
        const labelsContainer = dayCell.querySelector(".day-labels");
        if (isSmallMonth) {
          const label = document.createElement("div");
          label.className = "small-month-label";
          label.textContent = range.label;
          labelsContainer.appendChild(label);
        } else {
          const label = document.createElement("div");
          label.className = "range-label";
          const durationDays = getRangeDurationDays(range.startDate, range.endDate);
          label.textContent = range.label;
          // On single-range days the label blends seamlessly with the cell;
          // on multi-range days use a translucent chip so the even color
          // bands stay visible behind the label.
          label.style.backgroundColor = isMultiRange
            ? "rgba(255, 255, 255, 0.75)"
            : range.color;
          label.setAttribute('data-range-id', range.id);
          label.setAttribute('title', 'Option-drag to move • Double-click to edit');

          // Only add delete button in main month view
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-range";
          deleteBtn.innerHTML = "×";

          deleteBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
          });

          deleteBtn.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();

            savedRanges = savedRanges.filter(r => r.id !== range.id);
            updateRangesAndUI();
          });

          label.addEventListener("mouseenter", () => {
            setRangeHover(range.id, true);
          });

          label.addEventListener("mouseleave", () => {
            setRangeHover(range.id, false);
          });

          label.addEventListener("dblclick", async (e) => {
            e.stopPropagation();
            e.preventDefault();
            try {
              const result = await createLabelInput(
                startDate,
                endDate,
                range.label,
                "Modify Selected Range",
                range.note || ""
              );
              savedRanges = savedRanges.map(r => {
                if (r.id !== range.id) return r;
                return {
                  ...r,
                  label: result.label,
                  note: result.note,
                  startDate: result.startDate.toISOString(),
                  endDate: result.endDate.toISOString()
                };
              });
              updateRangesAndUI();
            } catch (error) {
              // User cancelled.
            }
          });

          label.addEventListener('mousedown', (e) => {
            if (!e.altKey || e.button !== 0) {
              return;
            }
            e.stopPropagation();
            e.preventDefault();

            const parentCell = dayCell;
            if (!parentCell || !parentCell.dataset.day) {
              return;
            }

            rangeDrag.mode = "move";
            rangeDrag.rangeId = range.id;
            rangeDrag.startDay = parseInt(parentCell.dataset.day, 10);
            rangeDrag.startDate = new Date(range.startDate);
            rangeDrag.endDate = new Date(range.endDate);
            rangeDrag.pendingStart = null;
            rangeDrag.pendingEnd = null;
          });

          label.appendChild(deleteBtn);
          labelsContainer.appendChild(label);

          const durationBadge = document.createElement("span");
          durationBadge.className = "range-duration";
          durationBadge.textContent = `${durationDays}d`;
          dayCell.appendChild(durationBadge);
        }
      }

      if (isEnd) {
        dayCell.classList.add('range-end');
      }

      // Add continuation indicators
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);

      if (day === 1 && startDate < firstDayOfMonth) {
        dayCell.classList.add('range-continues-left');
      }

      if (day === lastDayOfMonth.getDate() && endDate > lastDayOfMonth) {
        dayCell.classList.add('range-continues-right');
      }
    });
  }

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const createWeekdayLabels = (calendar) => {
    weekdays.forEach((day) => {
      const label = document.createElement("div");
      label.className = "weekday-label";
      label.textContent = day;
      calendar.appendChild(label);
    });
  };

  const clearCalendar = (calendar) => {
    calendar.innerHTML = "";
  };

  async function finalizeDateRange() {
    const clearSelectionUI = () => {
      isDragging = false;
      selectionStart = null;
      selectionEnd = null;

      document.querySelectorAll(".selection-count").forEach(counter => {
        counter.textContent = "";
      });

      document.querySelectorAll(".drag-highlight").forEach(cell => {
        cell.classList.remove("drag-highlight");
      });

      firstCell = null;
    };

    if (selectionStart && selectionEnd) {
      try {
        const startDay = Math.min(parseInt(selectionStart, 10), parseInt(selectionEnd, 10));
        const endDay = Math.max(parseInt(selectionStart, 10), parseInt(selectionEnd, 10));

        const result = await createLabelInput(startDay, endDay);
        const newRange = DateRange.create(result.startDate, result.endDate, result.label, undefined, result.note);

        savedRanges = [...savedRanges, newRange];
        updateRangesAndUI();
      } catch (e) {
        console.error('Error in finalizeDateRange:', e);
      } finally {
        clearSelectionUI();
      }
    } else {
      clearSelectionUI();
    }
  }

  const updateMonth = (year, month, elementId) => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const isSmallMonth = elementId !== "selectedMonth";

    const monthElement = document.getElementById(elementId);
    clearCalendar(monthElement);
    createWeekdayLabels(monthElement);

    // Create empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      monthElement.appendChild(createCalendarDay(null, year, month));
    }

    // Create cells for each day of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const cell = monthElement.appendChild(createCalendarDay(i, year, month));
      if (isCurrentMonth && i === today.getDate()) {
        cell.classList.add("today-highlight");
      }

      // Clear any existing styling
      cell.style.backgroundColor = "";
      cell.style.background = "";
      cell.classList.remove('range-start', 'range-end', 'range-continues-left', 'range-continues-right');
      cell.removeAttribute('title');
      cell.classList.remove('range-hover', 'drag-preview');
      delete cell.dataset.rangeIds;
      const labelsContainer = cell.querySelector(".day-labels");
      labelsContainer.innerHTML = "";
      cell.querySelectorAll(".range-duration").forEach(badge => badge.remove());

      // Add range display for all month views
      const cellDate = new Date(year, month, i);
      cellDate.setHours(12, 0, 0, 0);
      const matchingRanges = findMatchingRanges(cellDate);
      applyRangeStyling(cell, matchingRanges, isSmallMonth);
    }

    // Create empty cells to complete the last week if needed
    const totalDays = firstDay + daysInMonth;
    const remainingCells = (7 - (totalDays % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
      monthElement.appendChild(createCalendarDay(null, year, month));
    }
  };

  const updateCalendar = () => {
    const selectedMonth = parseInt(monthPicker.value);
    const selectedYear = parseInt(yearPicker.value);

    // Update the current month
    updateMonth(selectedYear, selectedMonth, "selectedMonth");

    // Calculate and update the previous month
    const prevMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    updateMonth(
      prevMonthDate.getFullYear(),
      prevMonthDate.getMonth(),
      "prevMonth"
    );
    document.getElementById("prevMonthLabel").textContent = getMonthNameAndYear(
      prevMonthDate.getFullYear(),
      prevMonthDate.getMonth()
    );

    // Calculate and update the next month
    const nextMonthDate = new Date(selectedYear, selectedMonth + 1, 1);
    updateMonth(
      nextMonthDate.getFullYear(),
      nextMonthDate.getMonth(),
      "nextMonth"
    );
    document.getElementById("nextMonthLabel").textContent = getMonthNameAndYear(
      nextMonthDate.getFullYear(),
      nextMonthDate.getMonth()
    );
  };

  monthPicker.addEventListener("change", updateCalendar);
  yearPicker.addEventListener("change", updateCalendar);
  
  // Navigation button handlers
  document.getElementById("prevMonthBtn").addEventListener("click", () => {
    const currentMonth = parseInt(monthPicker.value);
    const currentYear = parseInt(yearPicker.value);
    
    if (currentMonth === 0) {
      monthPicker.value = "11";
      yearPicker.value = (currentYear - 1).toString();
    } else {
      monthPicker.value = (currentMonth - 1).toString();
    }
    updateCalendar();
  });

  document.getElementById("nextMonthBtn").addEventListener("click", () => {
    const currentMonth = parseInt(monthPicker.value);
    const currentYear = parseInt(yearPicker.value);
    
    if (currentMonth === 11) {
      monthPicker.value = "0";
      yearPicker.value = (currentYear + 1).toString();
    } else {
      monthPicker.value = (currentMonth + 1).toString();
    }
    updateCalendar();
  });

  todayButton.addEventListener("click", () => {
    const today = new Date();
    monthPicker.value = today.getMonth().toString();
    yearPicker.value = today.getFullYear().toString();
    updateCalendar();
  });

  // Mouse event handlers for date selection
  const selectedContainer = document.getElementById("selectedMonth");

  selectedContainer.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      const targetDay = e.target.closest(".calendar-day");
      if (targetDay && targetDay.dataset.day) {
        if (e.target.closest(".range-label") || e.target.closest(".delete-range") || e.target.closest(".range-duration")) {
          return;
        }
        if (e.altKey) {
          const edge = getCornerHitType(targetDay, e.clientX, e.clientY);
          if (edge) {
            const rangeId = targetDay.dataset.rangeIds
              ? targetDay.dataset.rangeIds.split(",")[0]
              : null;
            if (rangeId) {
              const range = savedRanges.find(r => r.id === rangeId);
              if (range) {
                e.preventDefault();
                setRangeHandleDragState(range, edge, targetDay);
                return;
              }
            }
          }
        }
        isDragging = true;
        selectionStart = selectionEnd = targetDay.dataset.day;
        firstCell = targetDay;
        updateSelectionHighlights();
      }
    }
  });

  selectedContainer.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const targetDay = e.target.closest(".calendar-day");
      if (targetDay && targetDay.dataset.day) {
        selectionEnd = targetDay.dataset.day;
        updateSelectionHighlights();
      }
    }

    if (rangeDrag.mode !== "resize") {
      const targetDay = e.target.closest(".calendar-day");
      if (targetDay) {
        const edge = getCornerHitType(targetDay, e.clientX, e.clientY);
        if (edge) {
          targetDay.setAttribute('title', 'Option-drag corner to resize');
        } else if (targetDay.getAttribute('title') === 'Option-drag corner to resize') {
          targetDay.removeAttribute('title');
        }
      }
    }

    if (rangeDrag.mode !== "resize" && e.altKey) {
      const targetDay = e.target.closest(".calendar-day");
      if (!targetDay || !targetDay.dataset.day) {
        clearResizeHint();
        return;
      }
      const edge = getCornerHitType(targetDay, e.clientX, e.clientY);
      clearResizeHint();
      if (edge) {
        targetDay.classList.add("resize-hint");
      }
    } else if (rangeDrag.mode !== "resize") {
      clearResizeHint();
    }
  });

  // Prevent text selection while dragging
  selectedContainer.addEventListener("dragstart", (e) => {
    e.preventDefault();
  });

  document.addEventListener("mouseup", async (e) => {
    if (isDragging) {
        if (e.shiftKey) {
            // If Shift is pressed, create label
            await finalizeDateRange();
        } else {
            // If Shift is not pressed, clear everything including highlights
            isDragging = false;
            selectionStart = null;
            selectionEnd = null;

            if (firstCell) {
                const countContainer = firstCell.querySelector(".selection-count");
                countContainer.textContent = "";
                firstCell = null;
            }

            // Clear all highlights
            document.querySelectorAll(".drag-highlight").forEach(cell => {
                cell.classList.remove("drag-highlight");
            });
        }
    }

    if (rangeDrag.mode === "resize" || rangeDrag.mode === "move") {
      commitRangeDrag();
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (rangeDrag.mode === null) return;

    const targetDay = e.target.closest("#selectedMonth .calendar-day");
    if (!targetDay || !targetDay.dataset.day) return;
    const hoverDay = parseInt(targetDay.dataset.day, 10);
    if (!Number.isFinite(hoverDay)) return;

    if (rangeDrag.mode === "resize") {
      updateRangeResizePreview(hoverDay);
      return;
    }

    // mode === "move"
    if (rangeDrag.startDay === null) return;
    const deltaDays = hoverDay - rangeDrag.startDay;
    const newStart = addDays(rangeDrag.startDate, deltaDays);
    const newEnd = addDays(rangeDrag.endDate, deltaDays);

    if (isRangeOverlappingMonth(newStart, newEnd)) {
      rangeDrag.pendingStart = newStart;
      rangeDrag.pendingEnd = newEnd;
      updateDragPreview(newStart, newEnd);
    } else {
      rangeDrag.pendingStart = null;
      rangeDrag.pendingEnd = null;
      clearDragPreview();
    }
  });

  function updateSelectionHighlights() {
    let countHighlighted = 0;
    document.querySelectorAll("#selectedMonth .calendar-day").forEach((dayCell) => {
      const day = dayCell.dataset.day;
      if (!day) return;

      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);

      if (day >= start && day <= end) {
        dayCell.classList.add("drag-highlight");
        countHighlighted = end - start + 1;
      } else {
        dayCell.classList.remove("drag-highlight");
      }
    });

    if (isDragging && firstCell) {
      const countContainer = firstCell.querySelector(".selection-count");
      countContainer.textContent = countHighlighted || "";
    }
  }

  async function exportRanges() {
    const dataStr = JSON.stringify({ version: SCHEMA_VERSION, ranges: savedRanges }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });

    try {
      // Use the File System Access API if available
      if ('showSaveFilePicker' in window) {
        const opts = {
          suggestedName: 'calendar-ranges.json',
          types: [{
            description: 'JSON File',
            accept: {
              'application/json': ['.json'],
            },
          }],
          startIn: 'documents',
          id: 'calendarRanges'
        };

        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        // Show filename dialog for browsers without File System Access API
        const filename = await showFilenameDialog();

        // If user didn't cancel, proceed with download
        if (filename) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error saving file:', err);
        alert('Error saving file: ' + err.message);
      }
    }
  }

  function importRanges(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const parsed = JSON.parse(e.target.result);

        // Accept both the legacy bare-array format and the versioned
        // { version, ranges } wrapper.
        const importedRanges = Array.isArray(parsed) ? parsed : parsed && parsed.ranges;
        if (!Array.isArray(importedRanges)) {
          throw new Error('Invalid format: expected an array of ranges');
        }

        // Validate each range object, then regenerate IDs so importing the
        // same file twice can't create colliding ids.
        const sanitized = importedRanges.map(range => {
          if (!range || !range.startDate || !range.endDate || !range.label || !range.color) {
            throw new Error('Invalid range format');
          }
          if (isNaN(new Date(range.startDate)) || isNaN(new Date(range.endDate))) {
            throw new Error('Invalid date in range');
          }
          return { ...range, id: generateId() };
        });

        const importCount = sanitized.length;
        if (importCount === 0) {
          alert('No ranges found in file');
          return;
        }

        savedRanges = [...savedRanges, ...sanitized];
        updateRangesAndUI();

        alert(`Successfully imported ${importCount} range${importCount === 1 ? '' : 's'}`);
      } catch (error) {
        alert('Error importing ranges: ' + error.message);
      }
    };
    reader.readAsText(file);
  }

  function showFilenameDialog() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
      modal.style.zIndex = '1000';

      const dialog = document.createElement('div');
      dialog.className = 'bg-white rounded-lg p-6 max-w-sm mx-4';
      dialog.innerHTML = `
        <h3 class="text-lg font-bold mb-4">Save As</h3>
        <div class="mb-4">
          <input type="text"
                 id="filenameInput"
                 value="calendar-ranges.json"
                 class="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500">
        </div>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" id="cancelSave">Cancel</button>
          <button class="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white" id="confirmSave">Save</button>
        </div>
      `;

      modal.appendChild(dialog);
      document.body.appendChild(modal);

      // Focus the input and select filename (without extension)
      const input = dialog.querySelector('#filenameInput');
      input.focus();
      input.setSelectionRange(0, input.value.lastIndexOf('.'));

      const handleCancel = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      const handleConfirm = () => {
        const filename = input.value.trim();
        if (filename) {
          document.body.removeChild(modal);
          resolve(filename);
        } else {
          input.focus();
        }
      };

      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) handleCancel();
      });

      // Handle Enter and Escape keys
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleConfirm();
        } else if (e.key === 'Escape') {
          handleCancel();
        }
      });

      dialog.querySelector('#cancelSave').addEventListener('click', handleCancel);
      dialog.querySelector('#confirmSave').addEventListener('click', handleConfirm);
    });
  }

  function updateExportButtonState() {
    const exportButton = document.getElementById('exportBtn');
    if (exportButton) {
      exportButton.disabled = savedRanges.length === 0;
    }
  }

  // Function to set up the import/export UI
  function setupImportExport() {
    // Left side of the toolbar is reserved in index.html for these controls.
    const leftControls = document.getElementById('toolbarLeft');

    // Create import button
    const importButton = document.createElement('button');
    importButton.textContent = 'Import';
    importButton.className = 'bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded';

    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        importRanges(e.target.files[0]);
        e.target.value = '';
      }
    });

    importButton.addEventListener('click', () => fileInput.click());

    // Create export button
    const exportButton = document.createElement('button');
    exportButton.id = 'exportBtn';
    exportButton.textContent = 'Export';
    exportButton.className = 'bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed';
    exportButton.addEventListener('click', exportRanges);
    exportButton.disabled = savedRanges.length === 0;

    // Create clear button
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clearBtn';
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-red-600';

    // Create a styled confirmation dialog
    function showClearConfirmation() {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
      modal.style.zIndex = '1000';

      const dialog = document.createElement('div');
      dialog.className = 'bg-white rounded-lg p-6 max-w-sm mx-4';
      dialog.innerHTML = `
        <h3 class="text-lg font-bold mb-4">Clear All Data?</h3>
        <p class="text-gray-600 mb-6">This will delete all saved ranges. This action cannot be undone.</p>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" id="cancelClear">Cancel</button>
          <button class="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white" id="confirmClear">Clear All</button>
        </div>
      `;

      modal.appendChild(dialog);
      document.body.appendChild(modal);

      // Handle clicks
      const handleCancel = () => {
        document.body.removeChild(modal);
      };

      const handleConfirm = () => {
        savedRanges = [];
        localStorage.removeItem('calendarRanges');
        updateRangesAndUI();
        document.body.removeChild(modal);
      };

      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) handleCancel();
      });

      // Close on Escape key
      document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
          handleCancel();
          document.removeEventListener('keydown', closeOnEscape);
        }
      });

      dialog.querySelector('#cancelClear').addEventListener('click', handleCancel);
      dialog.querySelector('#confirmClear').addEventListener('click', handleConfirm);
    }

    clearBtn.addEventListener('click', showClearConfirmation);

    // Add all buttons to the left side of the toolbar.
    leftControls.appendChild(importButton);
    leftControls.appendChild(exportButton);
    leftControls.appendChild(clearBtn);
    leftControls.appendChild(fileInput);
  }

  // Persist + re-render without touching undo history. Used by undo/redo so
  // restoring a snapshot doesn't record a new one.
  function refreshUI() {
    saveRanges();
    updateCalendar();
    updateExportButtonState();
  }

  // Commit a mutation: record the prior state for undo, drop any redo branch,
  // then persist + re-render.
  function updateRangesAndUI() {
    history.past.push(history.baseline);
    if (history.past.length > history.limit) {
      history.past.shift();
    }
    history.future = [];
    history.baseline = cloneRanges(savedRanges);
    refreshUI();
  }

  function undo() {
    if (history.past.length === 0) return;
    history.future.push(cloneRanges(savedRanges));
    savedRanges = history.past.pop();
    history.baseline = cloneRanges(savedRanges);
    refreshUI();
  }

  function redo() {
    if (history.future.length === 0) return;
    history.past.push(cloneRanges(savedRanges));
    savedRanges = history.future.pop();
    history.baseline = cloneRanges(savedRanges);
    refreshUI();
  }

  // Keyboard undo/redo. Ignore while typing in a field so the browser's native
  // text undo still works inside the label/note modal.
  document.addEventListener("keydown", (e) => {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
  });

  // Seed the history baseline with whatever was loaded from storage.
  history.baseline = cloneRanges(savedRanges);

  setupImportExport();
  updateCalendar();
});
