// State Management
const state = {
    courses: [],
    currentCourseId: null,
    editingId: null,
    gradingStudentId: null,
    gradingAssignmentId: null,
    pendingAction: null // For confirmation modal
};

const views = {
    dashboard: document.getElementById('view-dashboard'),
    courseDetail: document.getElementById('view-course-detail'),
    settings: document.getElementById('view-settings')
};

const modals = {
    addCourse: document.getElementById('modal-add-course'),
    categories: document.getElementById('modal-categories'),
    assignment: document.getElementById('modal-assignment'),
    gradeRubric: document.getElementById('modal-grade-rubric'),
    confirm: document.getElementById('modal-confirm')
};

const saveState = () => {
    if (window.pywebview && window.pywebview.api) {
        window.pywebview.api.save_data(state.courses);
    } else if (window.electronAPI) {
        window.electronAPI.saveData(state.courses);
    } else {
        localStorage.setItem('pg_courses', JSON.stringify(state.courses));
    }
};
const generateId = () => Math.random().toString(36).substr(2, 9);
const getCurrentCourse = () => state.courses.find(c => c.id === state.currentCourseId);
const refreshIcons = () => {
    if (window.lucide) {
        try {
            lucide.createIcons();
        } catch (e) {
            console.error("Error refreshing icons:", e);
        }
    }
};

const navigateTo = (viewName) => {
    console.log('navigateTo called with:', viewName);
    try {
        Object.values(views).forEach(el => {
            if (el) {
                el.classList.remove('active');
                el.classList.add('hidden');
            }
        });
        const targetView = views[viewName];
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('active');
            console.log('Switched to view:', viewName);
        } else {
            console.error('Target view not found:', viewName);
        }

        if (viewName === 'dashboard') {
            renderDashboard();
            state.currentCourseId = null;
            updateActiveNavItem('btn-dashboard');
        } else if (viewName === 'settings') {
            updateActiveNavItem('btn-settings');
        } else {
            updateActiveNavItem(null);
        }
        refreshIcons();
    } catch (e) {
        console.error('Error in navigateTo:', e);
    }
};

const updateActiveNavItem = (activeId) => {
    document.querySelectorAll('.nav-item').forEach(btn => {
        if (activeId && btn.id === activeId) btn.classList.add('active');
        else btn.classList.remove('active');
    });
};

const showConfirm = (title, message, action) => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    state.pendingAction = action;
    modals.confirm.classList.remove('hidden');
    refreshIcons();
};

const migrateCourseData = (course) => {
    if (course.rubrics && !course.categories) {
        course.categories = [{ id: 'cat_default', name: 'General', weight: 100, parentId: null }];
        course.assignments = course.rubrics.map(r => ({ id: r.id, categoryId: 'cat_default', name: r.name, weight: r.weight, type: 'numeric' }));
        const newGrades = {};
        Object.keys(course.grades || {}).forEach(studentId => {
            newGrades[studentId] = {};
            Object.keys(course.grades[studentId]).forEach(rubricId => {
                newGrades[studentId][rubricId] = { value: parseFloat(course.grades[studentId][rubricId]) };
            });
        });
        course.grades = newGrades;
        delete course.rubrics;
        saveState();
    }
    if (course.categories) course.categories.forEach(c => { if (c.parentId === undefined) c.parentId = null; });
    if (!course.categories) course.categories = [];
    if (!course.assignments) course.assignments = [];
    if (!course.grades) course.grades = {};
};

const renderDashboard = () => {
    console.log('Rendering dashboard...');
    const grid = document.getElementById('courses-grid');
    const emptyState = document.getElementById('empty-state-courses');
    grid.innerHTML = '';
    if (!state.courses || state.courses.length === 0) { emptyState.classList.remove('hidden'); return; }
    emptyState.classList.add('hidden');
    state.courses.forEach(course => {
        migrateCourseData(course);
        const card = document.createElement('div');
        card.className = 'course-card';
        let totalSum = 0, count = 0;
        if (course.students && course.students.length > 0) {
            course.students.forEach(s => { totalSum += calculateStudentFinalGrade(course, s.id); });
            count = course.students.length;
        }
        const avg = count > 0 ? (totalSum / count).toFixed(1) : '-';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start">
                <h3>${course.name}</h3>
                <button class="btn-text btn-delete-course" style="color: #ef4444; padding:0; z-index: 10; position: relative;">
                    <i data-lucide="trash-2" style="width:16px"></i>
                </button>
            </div>
            <p>${course.description || 'Sin descripción'}</p>
            <div class="course-stats">
                <span><i data-lucide="users" style="width:14px; display:inline"></i> ${course.students ? course.students.length : 0} Alumnos</span>
                <span><i data-lucide="bar-chart-3" style="width:14px; display:inline"></i> Media: ${avg}</span>
            </div>
        `;

        const deleteBtn = card.querySelector('.btn-delete-course');
        deleteBtn.onclick = (e) => {
            console.log('Delete button clicked');
            e.stopPropagation();
            showConfirm('Eliminar Curso', `¿Seguro que quieres eliminar "${course.name}"?`, () => {
                state.courses = state.courses.filter(c => c.id !== course.id);
                saveState();
                renderDashboard();
            });
        };

        card.onclick = (e) => {
            console.log('Card clicked', e.target);
            if (e.target.closest('.btn-delete-course')) {
                console.log('Click ignored because it was on delete button (closest check)');
                return;
            }
            console.log('Opening course:', course.id);
            openCourse(course.id);
        };

        grid.appendChild(card);
    });
    refreshIcons();
};

const openCourse = (courseId) => {
    console.log('openCourse called with:', courseId);
    try {
        state.currentCourseId = courseId;
        const course = getCurrentCourse();
        if (!course) {
            console.error('Course not found in state');
            return;
        }
        console.log('Course found:', course.name);

        const titleEl = document.getElementById('current-course-name');
        if (titleEl) titleEl.textContent = course.name;
        else console.error('Element current-course-name not found');

        console.log('Switching to students tab');
        switchTab('students');

        console.log('Navigating to courseDetail');
        navigateTo('courseDetail');

        console.log('Rendering course data');
        renderCourseData();
    } catch (e) {
        console.error('Error in openCourse:', e);
    }
};

const renderCourseData = () => {
    const course = getCurrentCourse();
    if (!course) return;
    renderStudentsTab(course);
    renderConfigurationTab(course);
    renderGradesTable(course);
    refreshIcons();
};

const renderStudentsTab = (course) => {
    const tbody = document.querySelector('#students-table tbody');
    const empty = document.getElementById('empty-students');
    const count = document.getElementById('student-count');
    tbody.innerHTML = '';
    count.textContent = `${course.students ? course.students.length : 0} alumnos`;
    if (!course.students || course.students.length === 0) {
        empty.classList.remove('hidden');
        document.getElementById('students-table').classList.add('hidden');
    } else {
        empty.classList.add('hidden');
        document.getElementById('students-table').classList.remove('hidden');
        course.students.forEach(student => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="editable-text name-field">${student.name}</span></td>
                <td><span class="editable-text surname-field">${student.surname}</span></td>
                <td><button class="btn-text btn-delete-student" style="color: #ef4444"><i data-lucide="trash-2" style="width:16px"></i></button></td>
            `;

            row.querySelector('.name-field').onclick = () => editStudentName(student.id);
            row.querySelector('.surname-field').onclick = () => editStudentSurname(student.id);
            row.querySelector('.btn-delete-student').onclick = (e) => {
                e.stopPropagation();
                showConfirm('Eliminar Alumno', `¿Eliminar a ${student.name} ${student.surname}?`, () => {
                    course.students = course.students.filter(s => s.id !== student.id);
                    delete course.grades[student.id];
                    saveState();
                    renderCourseData();
                });
            };

            tbody.appendChild(row);
        });
    }
};

const getCategoryTree = (course) => {
    const roots = course.categories.filter(c => !c.parentId);
    const buildNode = (cat) => {
        const children = course.categories.filter(c => c.parentId === cat.id);
        return { ...cat, children: children.map(buildNode) };
    };
    return roots.map(buildNode);
};

const renderConfigurationTab = (course) => {
    const summaryContainer = document.getElementById('categories-summary');
    summaryContainer.innerHTML = '';
    const list = document.getElementById('assignments-list');
    list.innerHTML = '';
    if (course.categories.length === 0) {
        list.innerHTML = '<p class="text-muted p-4">Primero define las categorías de evaluación.</p>';
        return;
    }
    const tree = getCategoryTree(course);
    const renderNode = (node, container) => {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'config-tree-node';
        if (!node.parentId) nodeDiv.style.marginLeft = '0';
        const header = document.createElement('div');
        header.className = 'config-tree-node-header';
        header.innerHTML = `<h4>${node.name}</h4><span class="badge">${node.weight}%</span>`;
        nodeDiv.appendChild(header);
        const assignments = course.assignments.filter(a => a.categoryId === node.id);
        if (assignments.length > 0) {
            assignments.forEach(ass => {
                const item = document.createElement('div');
                item.className = 'assignment-item';
                let typeLabel = ass.type === 'rubric' ? 'Rúbrica' : 'Numérica';
                item.innerHTML = `
                    <div class="assignment-info">
                        <h4>${ass.name}</h4>
                        <div class="assignment-meta"><span>${typeLabel}</span>${ass.type === 'rubric' ? `<span>${ass.criteria?.length || 0} items</span>` : ''}</div>
                    </div>
                    <div style="display:flex; gap:0.5rem">
                        <button class="btn-text btn-edit-assignment"><i data-lucide="edit-2" style="width:16px"></i></button>
                        <button class="btn-text btn-delete-assignment" style="color: #ef4444"><i data-lucide="trash-2" style="width:16px"></i></button>
                    </div>
                `;
                item.querySelector('.btn-edit-assignment').onclick = () => editAssignment(ass.id);
                item.querySelector('.btn-delete-assignment').onclick = () => {
                    showConfirm('Borrar Actividad', `¿Borrar "${ass.name}"?`, () => {
                        course.assignments = course.assignments.filter(a => a.id !== ass.id);
                        Object.keys(course.grades).forEach(sid => { if (course.grades[sid][ass.id]) delete course.grades[sid][ass.id]; });
                        saveState();
                        renderCourseData();
                    });
                };
                nodeDiv.appendChild(item);
            });
        }
        if (node.children && node.children.length > 0) node.children.forEach(child => renderNode(child, nodeDiv));
        container.appendChild(nodeDiv);
    };
    tree.forEach(root => renderNode(root, list));
    tree.forEach(root => {
        const badge = document.createElement('div');
        badge.className = 'category-badge';
        badge.innerHTML = `<strong>${root.name}</strong> ${root.weight}%`;
        summaryContainer.appendChild(badge);
    });
};

const calculateCategoryGrade = (course, category, studentId) => {
    const children = course.categories.filter(c => c.parentId === category.id);
    if (children.length > 0) {
        let totalWeight = 0, weightedSum = 0;
        children.forEach(child => {
            const childGrade = calculateCategoryGrade(course, child, studentId);
            if (childGrade !== null) {
                weightedSum += childGrade * (child.weight / 100);
                totalWeight += child.weight;
            }
        });
        if (totalWeight === 0) return null;
        return (weightedSum / totalWeight) * 100;
    }
    const assignments = course.assignments.filter(a => a.categoryId === category.id);
    if (assignments.length === 0) return null;
    let sum = 0, count = 0;
    assignments.forEach(ass => {
        const gradeData = course.grades[studentId]?.[ass.id];
        if (gradeData && gradeData.value !== undefined && gradeData.value !== '') {
            sum += parseFloat(gradeData.value);
            count++;
        }
    });
    if (count === 0) return null;
    return sum / count;
};

const calculateStudentFinalGrade = (course, studentId) => {
    const roots = course.categories.filter(c => !c.parentId);
    let totalWeight = 0, weightedSum = 0;
    roots.forEach(root => {
        const grade = calculateCategoryGrade(course, root, studentId);
        if (grade !== null) {
            weightedSum += grade * (root.weight / 100);
            totalWeight += root.weight;
        }
    });
    if (totalWeight === 0) return 0;
    return (weightedSum / totalWeight) * 100;
};

const renderGradesTable = (course) => {
    const table = document.getElementById('grades-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    const columns = [];
    const getDepth = (cat) => {
        if (cat.parentId) {
            const parent = course.categories.find(c => c.id === cat.parentId);
            return 1 + (parent ? getDepth(parent) : 0);
        }
        return 0;
    };
    // Calculate max depth of the category tree (0-based)
    // If we have Root -> Sub, maxDepth is 1.
    // We need rows for: Level 0 (Root), Level 1 (Sub), Level 2 (Assignments/Totals).
    // So headerRowsCount should be maxDepth + 2.
    const maxDepth = course.categories.length > 0 ? course.categories.reduce((max, c) => Math.max(max, getDepth(c)), 0) : 0;
    const headerRowsCount = maxDepth + 2;

    const rows = [];
    for (let i = 0; i < headerRowsCount; i++) rows[i] = [];

    // The "Alumno" column spans all header rows
    rows[0].push(`<th rowspan="${headerRowsCount}" style="min-width:200px">Alumno</th>`);

    const traverse = (cat, level) => {
        const children = course.categories.filter(c => c.parentId === cat.id);
        const assignments = course.assignments.filter(a => a.categoryId === cat.id);

        const getNodeColspan = (node) => {
            const nodeChildren = course.categories.filter(c => c.parentId === node.id);
            const nodeAssignments = course.assignments.filter(a => a.categoryId === node.id);
            let cols = 0;
            if (nodeChildren.length > 0) cols += nodeChildren.reduce((sum, c) => sum + getNodeColspan(c), 0);
            if (nodeAssignments.length > 0) cols += nodeAssignments.length;
            cols += 1; // For the "Total" column of this category
            return cols;
        };

        const myColspan = getNodeColspan(cat);

        // Category Header
        // It should span 1 row usually, unless it's a leaf with no assignments (empty), then it spans to bottom?
        // But here we assume it sits above its content.
        // If it has children, they are at level + 1.
        // If it has assignments, they are at level + 1.
        // So rowspan is always 1.
        rows[level].push(`<th colspan="${myColspan}" class="category-header" data-level="${level}">${cat.name} (${cat.weight}%)</th>`);

        // Render Children (Subcategories)
        if (children.length > 0) {
            children.forEach(child => traverse(child, level + 1));
        }

        // Render Assignments
        // These are siblings of subcategories in the visual tree, so they go to level + 1.
        // They should span down to the bottom of the header.
        const contentLevel = level + 1;
        const rowspan = headerRowsCount - contentLevel;

        if (assignments.length > 0) {
            assignments.forEach(ass => {
                columns.push({ type: 'assignment', data: ass });
                rows[contentLevel].push(`<th rowspan="${rowspan}" class="assignment-header">${ass.name}<span>${ass.type === 'rubric' ? 'Rúbrica' : '0-10'}</span></th>`);
            });
        }

        // Render Total Column
        // Also goes to level + 1 and spans to bottom.
        columns.push({ type: 'total', data: cat });
        rows[contentLevel].push(`<th rowspan="${rowspan}" class="th-category-total">Total ${cat.name}</th>`);
    };

    const roots = course.categories.filter(c => !c.parentId);
    roots.forEach(root => traverse(root, 0));

    // Final Grade Column
    rows[0].push(`<th rowspan="${headerRowsCount}" class="th-final-grade">NOTA FINAL</th>`);

    thead.innerHTML = rows.map(r => `<tr>${r.join('')}</tr>`).join('');

    tbody.innerHTML = '';
    if (course.students) {
        course.students.forEach(student => {
            let rowHTML = `<tr><td>${student.surname}, ${student.name}</td>`;
            columns.forEach(col => {
                if (col.type === 'assignment') {
                    const ass = col.data;
                    const gradeData = course.grades[student.id]?.[ass.id];
                    const val = gradeData ? gradeData.value : '';
                    if (ass.type === 'numeric') {
                        rowHTML += `<td class="text-center"><input type="number" class="grade-input" value="${val}" min="0" max="10" step="0.1" onchange="updateNumericGrade('${student.id}', '${ass.id}', this.value)"></td>`;
                    } else {
                        const displayVal = val !== '' ? Number(val).toFixed(2) : '-';
                        const btnClass = val !== '' ? 'btn-small' : 'btn-secondary';
                        const style = val !== '' ? 'background: rgba(139, 92, 246, 0.2); color: white;' : 'padding: 0.2rem 0.5rem; font-size: 0.8rem;';
                        rowHTML += `<td class="text-center"><button class="${btnClass}" style="${style}" onclick="openGradingModal('${student.id}', '${ass.id}')">${displayVal} <i data-lucide="edit-3" style="width:12px; margin-left:4px"></i></button></td>`;
                    }
                } else if (col.type === 'total') {
                    const cat = col.data;
                    const total = calculateCategoryGrade(course, cat, student.id);
                    rowHTML += `<td class="td-category-total">${total !== null ? total.toFixed(2) : '-'}</td>`;
                }
            });
            const finalGrade = calculateStudentFinalGrade(course, student.id);
            const color = finalGrade >= 5 ? '#4ade80' : (finalGrade > 0 ? '#f87171' : '#a1a1aa');
            rowHTML += `<td class="td-final-grade" style="color:${color}">${finalGrade > 0 ? finalGrade.toFixed(2) : '-'}</td></tr>`;
            tbody.appendChild(document.createElement('tr')).innerHTML = rowHTML;
        });
    }
};

window.updateNumericGrade = (studentId, assignmentId, value) => {
    const course = getCurrentCourse();
    if (!course.grades[studentId]) course.grades[studentId] = {};
    if (value === '') delete course.grades[studentId][assignmentId];
    else {
        let num = parseFloat(value);
        if (num < 0) num = 0;
        if (num > 10) num = 10;
        course.grades[studentId][assignmentId] = { value: num };
    }
    saveState();
    renderGradesTable(course);
};

window.openGradingModal = (studentId, assignmentId) => {
    state.gradingStudentId = studentId;
    state.gradingAssignmentId = assignmentId;
    const course = getCurrentCourse();
    const assignment = course.assignments.find(a => a.id === assignmentId);
    const student = course.students.find(s => s.id === studentId);
    const gradeData = course.grades[studentId]?.[assignmentId] || { value: 0, criteriaValues: {} };
    document.getElementById('grading-modal-title').textContent = `Evaluar: ${student.name} - ${assignment.name}`;
    const container = document.getElementById('grading-criteria-container');
    container.innerHTML = '';
    if (!assignment.criteria || assignment.criteria.length === 0) {
        container.innerHTML = '<p>Error: No hay criterios definidos.</p>';
        return;
    }
    assignment.criteria.forEach(crit => {
        const currentVal = gradeData.criteriaValues?.[crit.id] || 0;
        const div = document.createElement('div');
        div.className = 'grading-item';
        div.innerHTML = `
            <div class="grading-item-header"><label>${crit.name}</label><span>Max: ${crit.maxPoints} pts</span></div>
            <div class="grading-slider-container">
                <input type="range" class="grading-slider" min="0" max="${crit.maxPoints}" step="0.5" value="${currentVal}" oninput="updateRubricPreview(this, '${crit.id}', ${crit.maxPoints})">
                <input type="number" class="grading-number-input" min="0" max="${crit.maxPoints}" step="0.5" value="${currentVal}" onchange="updateRubricPreview(this, '${crit.id}', ${crit.maxPoints})">
            </div>
        `;
        container.appendChild(div);
    });
    modals.gradeRubric.classList.remove('hidden');
    calculateRubricTotal();
    refreshIcons();
};

window.updateRubricPreview = (input, critId, max) => {
    const parent = input.parentElement;
    const slider = parent.querySelector('.grading-slider');
    const number = parent.querySelector('.grading-number-input');
    let val = parseFloat(input.value);
    if (val > max) val = max;
    if (val < 0) val = 0;
    slider.value = val;
    number.value = val;
    calculateRubricTotal();
};

const calculateRubricTotal = () => {
    const course = getCurrentCourse();
    const assignment = course.assignments.find(a => a.id === state.gradingAssignmentId);
    let totalPoints = 0, maxPoints = 0;
    const container = document.getElementById('grading-criteria-container');
    const inputs = container.querySelectorAll('.grading-number-input');
    inputs.forEach((input, index) => {
        totalPoints += parseFloat(input.value || 0);
        maxPoints += assignment.criteria[index].maxPoints;
    });
    let finalScore = 0;
    if (maxPoints > 0) finalScore = (totalPoints / maxPoints) * 10;
    document.getElementById('grading-total-score').textContent = finalScore.toFixed(2);
    return { finalScore };
};

window.editAssignment = (id) => {
    const course = getCurrentCourse();
    const assignment = course.assignments.find(a => a.id === id);
    if (!assignment) return;
    state.editingId = id;
    document.getElementById('input-ass-name').value = assignment.name;
    const select = document.getElementById('input-ass-category');
    select.innerHTML = '';
    const isLeaf = (catId) => !course.categories.some(c => c.parentId === catId);
    course.categories.filter(c => isLeaf(c.id)).forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });
    select.value = assignment.categoryId;
    document.getElementById('input-ass-type').value = assignment.type;
    const section = document.getElementById('rubric-config-section');
    const list = document.getElementById('rubric-criteria-list');
    list.innerHTML = '';
    if (assignment.type === 'rubric') {
        section.classList.remove('hidden');
        if (assignment.criteria) assignment.criteria.forEach(c => addCriteriaRow(c.name, c.maxPoints));
    } else section.classList.add('hidden');
    modals.assignment.classList.remove('hidden');
    refreshIcons();
};

window.deleteAssignment = (id) => {
    if (confirm('¿Borrar esta actividad?')) {
        const course = getCurrentCourse();
        course.assignments = course.assignments.filter(a => a.id !== id);
        Object.keys(course.grades).forEach(sid => { if (course.grades[sid][id]) delete course.grades[sid][id]; });
        saveState();
        renderCourseData();
    }
};

const addCategoryRow = (id, name, weight, level, parentId) => {
    const container = document.getElementById('categories-list-container');
    const div = document.createElement('div');
    div.className = 'category-row category-tree-item';
    div.dataset.id = id;
    div.dataset.parentId = parentId === null ? 'null' : parentId;
    let indentHTML = '';
    for (let i = 0; i < level; i++) indentHTML += '<div class="indent-guide"></div>';
    div.innerHTML = `
        ${indentHTML}
        <div class="category-row-inputs">
            <input type="text" class="cat-name" placeholder="Categoría" value="${name}" style="flex:2">
            <input type="number" class="cat-weight" placeholder="%" value="${weight}" style="flex:1" onchange="updateCategoriesTotal()">
        </div>
        <div class="category-controls">
            <button class="btn-small btn-add-subcategory" title="Añadir Subcategoría"><i data-lucide="plus" style="width:14px"></i></button>
            <button class="btn-text btn-remove-category" style="color:#ef4444"><i data-lucide="trash-2" style="width:14px"></i></button>
        </div>
    `;
    div.querySelector('.btn-add-subcategory').onclick = () => addSubCategory(id, level + 1);
    div.querySelector('.btn-remove-category').onclick = () => { div.remove(); updateCategoriesTotal(); };
    container.appendChild(div);
    refreshIcons();
};

window.addSubCategory = (parentId, level) => {
    const parentRow = document.querySelector(`.category-row[data-id="${parentId}"]`);
    const div = document.createElement('div');
    div.className = 'category-row category-tree-item';
    const newId = generateId();
    div.dataset.id = newId;
    div.dataset.parentId = parentId;
    let indentHTML = '';
    for (let i = 0; i < level; i++) indentHTML += '<div class="indent-guide"></div>';
    div.innerHTML = `
        ${indentHTML}
        <div class="category-row-inputs">
            <input type="text" class="cat-name" placeholder="Subcategoría" value="" style="flex:2">
            <input type="number" class="cat-weight" placeholder="%" value="0" style="flex:1" onchange="updateCategoriesTotal()">
        </div>
        <div class="category-controls">
            <button class="btn-small btn-add-subcategory" title="Añadir Subcategoría"><i data-lucide="plus" style="width:14px"></i></button>
            <button class="btn-text btn-remove-category" style="color:#ef4444"><i data-lucide="trash-2" style="width:14px"></i></button>
        </div>
    `;
    div.querySelector('.btn-add-subcategory').onclick = () => addSubCategory(newId, level + 1);
    div.querySelector('.btn-remove-category').onclick = () => { div.remove(); updateCategoriesTotal(); };
    parentRow.after(div);
    refreshIcons();
};

const updateCategoriesTotal = () => {
    let total = 0;
    document.querySelectorAll('.category-row').forEach(row => { if (row.dataset.parentId === 'null') total += parseFloat(row.querySelector('.cat-weight').value) || 0; });
    const el = document.getElementById('categories-total-weight');
    el.textContent = `Total (Raíz): ${total}%`;
    el.style.color = total === 100 ? '#4ade80' : '#fbbf24';
};

const addCriteriaRow = (name = '', max = 1) => {
    const list = document.getElementById('rubric-criteria-list');
    const div = document.createElement('div');
    div.className = 'criteria-row';
    div.innerHTML = `
        <input type="text" class="crit-name" placeholder="Criterio" value="${name}">
        <input type="number" class="crit-max" placeholder="Max" value="${max}">
        <button class="btn-text btn-remove-criteria" style="color:#ef4444"><i data-lucide="trash-2"></i></button>
    `;
    div.querySelector('.btn-remove-criteria').onclick = () => div.remove();
    list.appendChild(div);
    refreshIcons();
};

const switchTab = (tabName) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
};

window.editStudentName = (id) => {
    const c = getCurrentCourse();
    const s = c.students.find(st => st.id === id);
    const n = prompt("Nombre:", s.name);
    if (n) { s.name = n; saveState(); renderCourseData(); }
};

window.editStudentSurname = (id) => {
    const c = getCurrentCourse();
    const s = c.students.find(st => st.id === id);
    const n = prompt("Apellidos:", s.surname);
    if (n) { s.surname = n; saveState(); renderCourseData(); }
};

window.deleteStudent = (id) => {
    if (confirm("¿Eliminar alumno?")) {
        const c = getCurrentCourse();
        c.students = c.students.filter(s => s.id !== id);
        delete c.grades[id];
        saveState();
        renderCourseData();
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    if (window.electronAPI) {
        const loaded = await window.electronAPI.loadData();
        if (loaded) state.courses = loaded;
    } else {
        const stored = localStorage.getItem('pg_courses');
        if (stored) state.courses = JSON.parse(stored);
    }
    renderDashboard();

    // Global Modal Close
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = () => {
            btn.closest('.modal').classList.add('hidden');
            state.pendingAction = null;
        }
    });

    // Confirm Action Button
    document.getElementById('btn-confirm-action').onclick = () => {
        if (state.pendingAction) {
            state.pendingAction();
            state.pendingAction = null;
        }
        modals.confirm.classList.add('hidden');
    };

    document.getElementById('btn-dashboard').onclick = () => navigateTo('dashboard');
    document.getElementById('btn-back-dashboard').onclick = () => navigateTo('dashboard');
    document.getElementById('btn-settings').onclick = () => navigateTo('settings');
    document.getElementById('btn-add-course').onclick = () => { document.getElementById('input-course-name').value = ''; document.getElementById('input-course-desc').value = ''; modals.addCourse.classList.remove('hidden'); refreshIcons(); };
    document.getElementById('btn-save-course').onclick = () => {
        const name = document.getElementById('input-course-name').value;
        const desc = document.getElementById('input-course-desc').value;
        if (name) {
            state.courses.push({ id: generateId(), name, description: desc, students: [], categories: [], assignments: [], grades: {} });
            saveState();
            modals.addCourse.classList.add('hidden');
            renderDashboard();
        }
    };
    document.getElementById('btn-manage-categories').onclick = () => {
        const course = getCurrentCourse();
        const container = document.getElementById('categories-list-container');
        container.innerHTML = '';
        const renderTreeEditor = (parentId = null, level = 0) => {
            const cats = course.categories.filter(c => c.parentId === parentId);
            cats.forEach(cat => { addCategoryRow(cat.id, cat.name, cat.weight, level, parentId); renderTreeEditor(cat.id, level + 1); });
        };
        renderTreeEditor();
        updateCategoriesTotal();
        modals.categories.classList.remove('hidden');
        refreshIcons();
    };
    document.getElementById('btn-add-category-row').onclick = () => addCategoryRow(generateId(), '', 0, 0, null);
    document.getElementById('btn-save-categories').onclick = () => {
        const course = getCurrentCourse();
        const rows = document.querySelectorAll('.category-row');
        const newCats = [];
        rows.forEach(row => {
            const name = row.querySelector('.cat-name').value;
            const weight = parseFloat(row.querySelector('.cat-weight').value) || 0;
            const id = row.dataset.id;
            const parentId = row.dataset.parentId === 'null' ? null : row.dataset.parentId;
            if (name) newCats.push({ id, name, weight, parentId });
        });
        course.categories = newCats;
        saveState();
        modals.categories.classList.add('hidden');
        renderCourseData();
    };
    document.getElementById('btn-add-assignment').onclick = () => {
        state.editingId = null;
        const course = getCurrentCourse();
        if (course.categories.length === 0) { alert("Primero crea categorías."); return; }
        const select = document.getElementById('input-ass-category');
        select.innerHTML = '';
        const isLeaf = (catId) => !course.categories.some(c => c.parentId === catId);
        course.categories.filter(c => isLeaf(c.id)).forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });
        document.getElementById('input-ass-name').value = '';
        document.getElementById('rubric-criteria-list').innerHTML = '';
        document.getElementById('input-ass-type').value = 'numeric';
        document.getElementById('rubric-config-section').classList.add('hidden');
        modals.assignment.classList.remove('hidden');
        refreshIcons();
    };
    document.getElementById('input-ass-type').onchange = (e) => {
        const section = document.getElementById('rubric-config-section');
        if (e.target.value === 'rubric') {
            section.classList.remove('hidden');
            if (document.getElementById('rubric-criteria-list').children.length === 0) addCriteriaRow();
        } else section.classList.add('hidden');
        refreshIcons();
    };
    document.getElementById('btn-add-criteria').onclick = () => addCriteriaRow();
    document.getElementById('btn-save-assignment').onclick = () => {
        const course = getCurrentCourse();
        const name = document.getElementById('input-ass-name').value;
        const catId = document.getElementById('input-ass-category').value;
        const type = document.getElementById('input-ass-type').value;
        if (!name) return;
        let assignment;
        if (state.editingId) {
            assignment = course.assignments.find(a => a.id === state.editingId);
            assignment.name = name;
            assignment.categoryId = catId;
            assignment.type = type;
            assignment.criteria = [];
        } else {
            assignment = { id: generateId(), categoryId: catId, name, type, weight: 1, criteria: [] };
            course.assignments.push(assignment);
        }
        if (type === 'rubric') {
            const rows = document.querySelectorAll('.criteria-row');
            rows.forEach(row => {
                const cName = row.querySelector('.crit-name').value;
                const cMax = parseFloat(row.querySelector('.crit-max').value);
                if (cName && cMax) assignment.criteria.push({ id: generateId(), name: cName, maxPoints: cMax });
            });
        }
        saveState();
        modals.assignment.classList.add('hidden');
        renderCourseData();
    };
    document.getElementById('btn-save-rubric-grade').onclick = () => {
        const { finalScore } = calculateRubricTotal();
        const course = getCurrentCourse();
        if (!course.grades[state.gradingStudentId]) course.grades[state.gradingStudentId] = {};
        const criteriaValues = {};
        const container = document.getElementById('grading-criteria-container');
        const inputs = container.querySelectorAll('.grading-number-input');
        const assignment = course.assignments.find(a => a.id === state.gradingAssignmentId);
        inputs.forEach((input, index) => { criteriaValues[assignment.criteria[index].id] = parseFloat(input.value); });
        course.grades[state.gradingStudentId][state.gradingAssignmentId] = { value: finalScore, criteriaValues };
        saveState();
        modals.gradeRubric.classList.add('hidden');
        renderGradesTable(course);
    };
    document.querySelectorAll('.tab-btn').forEach(btn => { btn.onclick = () => switchTab(btn.dataset.tab); });
    const fileInput = document.getElementById('csv-input');
    document.getElementById('btn-import-csv').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const lines = event.target.result.split(/\r\n|\n/);
                const course = getCurrentCourse();
                let count = 0;
                lines.forEach((line, idx) => {
                    if (!line.trim()) return;
                    const parts = line.split(/[;,]/);
                    if (parts.length >= 2) {
                        if (idx === 0 && parts[0].toLowerCase().includes('nombre')) return;
                        if (!course.students) course.students = [];
                        course.students.push({ id: generateId(), name: parts[0].trim(), surname: parts[1].trim() });
                        count++;
                    }
                });
                saveState();
                renderCourseData();
                alert(`${count} alumnos importados.`);
            };
            reader.readAsText(file);
        }
        fileInput.value = '';
    };
    document.getElementById('btn-clear-data').onclick = () => {
        showConfirm('Borrar Todo', '¿Seguro que quieres borrar TODOS los datos? Esta acción no se puede deshacer.', () => {
            localStorage.removeItem('pg_courses');
            state.courses = [];
            state.currentCourseId = null;
            navigateTo('dashboard');
        });
    };
});

window.addEventListener('pywebviewready', async () => {
    try {
        const loaded = await window.pywebview.api.load_data();
        if (loaded) {
            state.courses = loaded;
            renderDashboard();
        }
    } catch (e) {
        console.error("Error loading data from pywebview:", e);
    }
});
