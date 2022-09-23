<script lang="ts">
    import * as bootstrap from "bootstrap";
    let modalEl;
    export function show() {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div class="modal fade" id="aboutModal" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addStemmaLabel">О проекте</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                <img src="assets/logo_color.webp" alt="" width="100" height="100" class="mx-auto d-block" />

                <div class="mt-4">
                    <h6>Stemma</h6>
                    <p>
                        Stemma - некомерческий проект, который начался с попытки собрать и систематизировать большое генеалогическое дерево. Довольно скоро
                        выяснилось, что в одиночку собирать информацию о дальних родственниках сложно, поэтому мы решили дать возможность редактировать древо
                        всем вместе.
                    </p>
                </div>

                <div class="mt-4">
                    <h6>Вы можете добавлять информацию о семьях</h6>
                    <p>
                        Семья состоит из детей и родителей, и состоит как минимум из двух человек. Семья обозначается небольшим кругом. Отношения в семье
                        показаны направленными стрелками разной толщины.
                    </p>
                </div>

                <div class="mt-4">
                    <h6>Могут быть тезки!</h6>
                    <p>
                        При создании семьи необходимо учитывать, что система может уже содержать человека с указанным именем - тезку. В таком случае вы должны
                        уточнить, хотите ли вы создать нового человека-тезку, или же добавить уже существующему человеку дополнительные родственные связи
                    </p>
                </div>
                <div class="mt-4">
                    <h6>Делитесь родословной</h6>
                    <p>
                        Вы можете создавать неограниченное количество родословных доступных только вам, а можете пригласить новых пользователей в проект, тем
                        самым давая им права на добавление новых и редактирование их прямых родственников.
                    </p>
                </div>
                <div class="mt-4">
                    <h6>Возникли проблемы?</h6>
                    <p>
                        Такое бывает, не расстраивайтесь. Можете задать вопрос, пожаловаться, или наоборот, похвалить нас, написав на <a
                            href="mailto:danilasergeevich@gmail.com">почту</a
                        >
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Понятно</button>
            </div>
        </div>
    </div>
</div>
