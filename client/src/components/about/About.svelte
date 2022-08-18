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
                        <div class="carousel-item active" data-bs-interval="10000">
                            <img src="/assets/create_family.webp" class="d-block w-100" alt="..." />
                            <div class="carousel-caption d-none d-md-block">
                                <h5>Вы можете добавлять иформацию о семьях</h5>
                                <p>
                                    Семья состоит из детей и родителей, и состоит как минимум из двух человек. Семья обозначается небольшим кругом. Отношения в
                                    семье показаны направленными стрелками разной толщины.
                                </p>
                            </div>
                        </div>
                        <div class="carousel-item" data-bs-interval="2000">
                            <img src="/assets/select_person.webp" class="d-block w-100" alt="..." />
                            <div class="carousel-caption d-none d-md-block">
                                <p>
                                    При создании семьи необходимо учитывать, что система может уже содержать человека с указанным именем - тезку. В таком случае
                                    вы должны уточнить, хотите ли вы создать нового человека-тезку, или же выбрать добавить уже существующему человеку
                                    дополнительные родственные связи
                                </p>
                            </div>
                        </div>
                        <div class="carousel-item">
                            <img src="/assets/invite.webp" class="d-block w-100" alt="..." />
                            <div class="carousel-caption d-none d-md-block">
                                <h5>Не стесняйтесь создавать ссылки для своих кузенов и кузин</h5>
                                <p>
                                    Родословная - это единый граф, объединяющий членов семей родственными связями. Вы создавать неограниченное количество
                                    родословных доступных только вам, а можете пригласить новых пользователей в проект, тем самым дав им права на добавление
                                    новых и редактивроание их прямых родственников.
                                </p>
                            </div>
                        </div>
                    </div>
                    <button class="carousel-control-prev" type="button" data-bs-target="#carouselExampleDark" data-bs-slide="prev">
                        <span class="carousel-control-prev-icon" aria-hidden="true" />
                        <span class="visually-hidden">Previous</span>
                    </button>
                    <button class="carousel-control-next" type="button" data-bs-target="#carouselExampleDark" data-bs-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true" />
                        <span class="visually-hidden">Next</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
