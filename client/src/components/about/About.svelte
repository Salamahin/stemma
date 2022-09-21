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
                <div id="carouselExampleDark" class="carousel carousel-dark slide" data-bs-ride="carousel">
                    <div class="carousel-indicators">
                        <button
                            type="button"
                            data-bs-target="#carouselExampleDark"
                            data-bs-slide-to="0"
                            class="active"
                            aria-current="true"
                            aria-label="Slide 1"
                        />
                        <button type="button" data-bs-target="#carouselExampleDark" data-bs-slide-to="1" aria-label="Slide 2" />
                        <button type="button" data-bs-target="#carouselExampleDark" data-bs-slide-to="2" aria-label="Slide 3" />
                    </div>
                    <div class="carousel-inner">
                        <div class="carousel-item active" data-bs-interval="3000">
                            <div>
                                <h6>Вы можете добавлять информацию о семьях</h6>
                                <p>
                                    Семья состоит из детей и родителей, и состоит как минимум из двух человек. Семья обозначается небольшим кругом. Отношения в
                                    семье показаны направленными стрелками разной толщины.
                                </p>
                                <img src="/assets/create_family.webp" class="d-block w-100" alt="..." />
                            </div>
                        </div>
                        <div class="carousel-item" data-bs-interval="3000">
                            <div>
                                <h6>Могут быть тезки!</h6>
                                <p>
                                    При создании семьи необходимо учитывать, что система может уже содержать человека с указанным именем - тезку. В таком случае
                                    вы должны уточнить, хотите ли вы создать нового человека-тезку, или же добавить уже существующему человеку дополнительные
                                    родственные связи
                                </p>
                            </div>
                            <img src="/assets/select_person.webp" class="d-block w-100" alt="..." />
                        </div>
                        <div class="carousel-item" data-bs-interval="3000">
                            <div>
                                <h6>Делитесь родословной</h6>
                                <p>
                                    Вы можете создавать неограниченное количество родословных доступных только вам, а можете пригласить новых пользователей 
                                    в проект, тем самым давая им права на добавление новых и редактирование их прямых родственников.
                                </p>
                                <img src="/assets/invite.webp" class="d-block w-100" alt="..." />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Понятно</button>
            </div>
        </div>
    </div>
</div>
