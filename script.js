const dayNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
        const IPEauditories = ["502-2 к.", "601-2 к.", "603-2 к.", "604-2 к.", "605-2 к.", "607-2 к.", "611-2 к.", "613-2 к.", "615-2 к."];

        async function fetchJson(url) {
            const response = await fetch(url);
            return response.json();
        }

        async function getTeacherInfo() {
            const teachers = await fetchJson('https://iis.bsuir.by/api/v1/employees/all');
            const teacherSchedules = {};

            const promises = teachers.map(async (teacher) => {
                try {
                    const schedule = await fetchJson(`https://iis.bsuir.by/api/v1/employees/schedule/${teacher.urlId}`);
                    teacherSchedules[teacher.urlId] = schedule;
                } catch (error) {
                    console.error(`${teacher.urlId} generated an exception:`, error);
                }
            });

            await Promise.all(promises);
            return { teachers, teacherSchedules };
        }

        function parseDate(dateStr) {
            return dateStr ? new Date(dateStr.split('.').reverse().join('-')) : null;
        }

        function addLessonToSchedule(schedule, lesson, teacher) {
            schedule[`${lesson.startLessonTime}—${lesson.endLessonTime}`] = `${lesson.subject} (${lesson.lessonTypeAbbrev}) ${teacher.fio}`;
        }

        function timeInRange(start, end, x) {
            return start <= x && x <= end;
        }

        async function requestDaily(aud, teachers, teacherSchedules, selectedDate, isPrevious = false) {
            const schedule = {};
            const dayName = dayNames[selectedDate.getDay()];

            for (const teacher of teachers) {
                const teacherSchedule = teacherSchedules[teacher.urlId] || {};
                const weekDaySchedule = isPrevious ? teacherSchedule.previousSchedules?.[dayName] || [] : teacherSchedule.schedules?.[dayName] || [];

                for (const lesson of weekDaySchedule) {
                    
                    if (lesson && lesson.auditories && lesson.auditories.includes(aud)) {
                        const start = parseDate(lesson.startLessonDate);
                        const end = parseDate(lesson.endLessonDate);
                        const lessonDate = parseDate(lesson.dateLesson);

                        if (start && end && timeInRange(start, end, selectedDate)) {
                            addLessonToSchedule(schedule, lesson, teacher);
                        } else if (lessonDate && selectedDate.toDateString() === lessonDate.toDateString()) {
                            addLessonToSchedule(schedule, lesson, teacher);
                        }
                    }
                }
            }
            return schedule;
        }

        function printDict(container, dict) {
            for (const [timeRange, details] of Object.entries(dict)) {
                const lessonDiv = document.createElement('div');
                lessonDiv.className = 'lesson';
                lessonDiv.innerText = `${timeRange} ————— ${details}`;
                container.appendChild(lessonDiv);
            }
        }

        async function printSchedulesIPE(selectedDate) {
            const { teachers, teacherSchedules } = await getTeacherInfo();
            
            const schedulesContainer = document.getElementById('schedules');
            schedulesContainer.innerHTML = ''; // Clear previous schedules

            for (const aud of IPEauditories) {
                const audContainer = document.createElement('div');
                audContainer.className = 'auditory';
                audContainer.innerText = `-------------------------${aud}-------------------------`;
                schedulesContainer.appendChild(audContainer);

                // Получаем текущее расписание
                const currentSchedule = await requestDaily(aud, teachers, teacherSchedules,selectedDate);
                // Получаем предыдущее расписание
                const previousSchedule = await requestDaily(aud, teachers, teacherSchedules, selectedDate, true);

                // Объединяем расписания
                const combinedSchedule = { ...currentSchedule, ...previousSchedule };

                // Сортируем расписание по времени
                const sortedSchedule = Object.keys(combinedSchedule).sort().reduce((obj, key) => {
                    obj[key] = combinedSchedule[key];
                    return obj;
                }, {});

                printDict(audContainer, sortedSchedule);
            }
        }

        document.getElementById('datePicker').addEventListener('change', async (event) => {
            const selectedDate = new Date(event.target.value);
            document.getElementById('loading').style.display = 'block'; // Показываем окно "Загрузка..."
            try {
                await printSchedulesIPE(selectedDate);
            } finally {
                document.getElementById('loading').style.display = 'none'; // Скрываем окно "Загрузка..."
            }
        });

        // Initialize with the current date
        const initialDate = new Date();
        document.getElementById('datePicker').valueAsDate = initialDate;
        document.getElementById('loading').style.display = 'block'; // Показываем окно "Загрузка..."
        (async () => {
            try {
                await printSchedulesIPE(initialDate);
            } finally {
                document.getElementById('loading').style.display = 'none'; // Скрываем окно "Загрузка..."
            }
        })();

        function copyAndSend() {
            const textToCopy = document.getElementById('schedules').innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                alert('Текст скопирован!');
                const telegramLink = `tg://msg?text=${encodeURIComponent(textToCopy)}`;
                window.open(telegramLink, '_blank');
            }).catch(err => {
                console.error('Ошибка при копировании текста: ', err);
            });
        }
