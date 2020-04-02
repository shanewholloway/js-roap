const sym_ao = Symbol.asyncIterator;
const sym_iter = Symbol.iterator;

async function * as_ao_iter(ao_iterable) {
  yield * ao_iterable;}

function is_ao_iterable(v) {
  return v !== undefined && v !== null &&
    'function' === typeof (v[sym_ao] || v.next || v[sym_iter])}

function as_ao_iter_checked(ao_iterable) {
  if (! is_ao_iterable(ao_iterable)) {
    throw new TypeError('Expected an ao_iterable') }

  return as_ao_iter(ao_iterable)}

const _ret_void = e => {};
const _ident = e => e;
const _e_value = e => e.value;
const _e_tip = e => e.tip;

const deferred = ((() => {
  const _l=[], _lset = _l.splice.bind(_l, 1, 3);
  return host =>(
    _l[0] = new Promise(_lset)
  , _l) })());

function ao_fence() {
  let _fp, _resume = _ret_void;
  const _set = y => _resume = y;

  const resume = v => {
    _fp = undefined;
    _resume(v);};

  const fence = (() =>
    undefined !== _fp ? _fp :
      _fp = new Promise(_set) );

  return [fence, resume]}

function ao_push(xform) {
  const [aod, ao_push] = ao_latest();
  if (undefined !== xform) {
    aod.xform = as_fn(xform);}

  ao_push.aod = aod;
  ao_push[sym_ao] = aod[sym_ao];
  return ao_push}


async function * _ao_iter_latest(aod) {
  let _cur;
  while (true) {
    let _tip;
    while (_cur === (_tip = aod.tip)) {
      if (aod.done) {return}

      await aod.tail();}

    yield _cur = _tip;} }


const sym_ao_latest = Symbol('ao_latest');
const __ao_latest__ ={
  get [sym_ao_latest]() {return this}
, xform: _ident
, get [sym_ao]() {
    return _ao_iter_latest.bind(null, this)}

, ao_iter() {
    return _ao_iter_latest(this)}

, async ao_each(fn) {
    for await (const tip of this) {
      await fn(tip);} }

, async * ao_map(fn) {
    for await (const tip of this) {
      yield await fn(tip);} }

, async * ao_filter(fn) {
    for await (const tip of this) {
      if (await fn(tip)) {
        yield tip;} } }

, async * ao_map_if(fn) {
    for await (const tip of this) {
      const res = await fn(tip);
      if (res) {yield res;} } } };


function ao_latest() {
  const [tail, resume] = ao_fence();
  const [_fin, _do_stop] = deferred();

  const aod ={
    __proto__: __ao_latest__
  , tip: undefined, done: false,
    stop, tail};

  Object.assign(update,{
    update, stop, 
    fin: fn => _fin.finally(_as_fin(fn)) } );

  return [aod, update]

  function update(tip) {
    aod.tip = tip = aod.xform(tip);
    resume(tip); }

  function stop(v) {
    aod.done = true;
    resume();
    _do_stop(v);
    return _fin} }


function _as_fin(fn) {
  if ('function' === typeof fn.return) {
    return v => fn.return(v)}
  return fn}

function ao_update_ctx(ao_ctx_mgr) {
  const [aod, ao_update] = ao_latest();

  ao_ctx_mgr = as_ao_iter_checked(
    ao_ctx_mgr(ao_update));

  ao_update.fin(ao_ctx_mgr);
  aod.ready = _ao_init(ao_ctx_mgr, aod);
  return aod}

async function _ao_init(ao_ctx_mgr, aod) {
  const {value: xform} = await ao_ctx_mgr.next();
  if ('function' === typeof xform) {
    aod.xform = xform;}
  return true}

function ao_watch(ao_iter) {
  ao_iter = as_ao_iter_checked(ao_iter);

  const [aod, ao_update] = ao_latest();
  ao_update.fin(ao_iter);
  aod.complete = _ao_walk(ao_iter, ao_update);
  return aod}

async function _ao_walk(ao_iter, fn) {
  for await (const v of ao_iter) {
    await fn(v);} }

async function as_ao_dep(arg) {
  if (undefined !== arg && null !== arg || 'object' !== typeof arg) {

    const aod = arg[sym_ao_latest];
    if (undefined !== aod) {
      return aod}

    if (arg[sym_ao]) {
      return ao_watch(arg)}

    if ('object' === typeof arg && 'tip' in arg) {
      return arg} }

  return { tip: arg }}

async function ao_deps_map(by_entries) {
  const aow_deps = new Map();
  for (const [name, arg] of by_entries) {
    aow_deps.set(name, await as_ao_dep(arg)); }
  return aow_deps}


async function ao_deps_vec(by_vec) {
  const aow_deps = [];
  for (const arg of by_vec) {
    aow_deps.push(await as_ao_dep(arg)); }
  return aow_deps}


async function _ao_deps_change(iter_deps) {
  await new Promise (( resolve ) => {
    for (const {tail} of iter_deps) {
      if (undefined !== tail) {
        tail().then(resolve);} } }); }

async function _ao_deps_map_updates(ao_update, deps) {
  deps = await ao_deps_map(deps);
  while (true) {
     {
      const snap = {};
      for (const [k, arg] of deps.entries()) {
        snap[k] = arg.tip;}

      ao_update(snap); }

    await _ao_deps_change(deps.values()); } }

async function _ao_deps_vec_updates(ao_update, deps) {
  deps = await ao_deps_vec(deps);
  while (true) {
     {
      const snap = Array.from(deps, _e_tip);

      ao_update(snap); }

    await _ao_deps_change(deps); } }

function ao_track(deps) {
  const [aod, ao_update] = ao_latest();
  aod.complete = Array.isArray(deps) 
    ? _ao_deps_vec_updates(ao_update, deps)
    : _ao_deps_map_updates(ao_update, Object.entries(deps));
  return aod}

function ao_track_vec(deps) {
  const [aod, ao_update] = ao_latest();
  aod.complete = _ao_deps_vec_updates(ao_update, deps);
  return aod}

function ao_track_entries(deps) {
  const [aod, ao_update] = ao_latest();
  aod.complete = _ao_deps_map_updates(ao_update, deps);
  return aod}

function ao_track_kw(deps) {
  deps = Object.entries(deps);
  const [aod, ao_update] = ao_latest();
  aod.complete = _ao_deps_map_updates(ao_update, deps);
  return aod}

const _en_click = ['click'];
const _en_input = ['input', 'change'];
const _e_no_default = e => e.preventDefault();
const _opt_unpack = ({text, value}) =>({text, value});
const _dom_std_args ={
  _:[_en_click]
, 'input':[_en_input, _e_value]
, 'output':[_en_input, _e_value]
, 'input,number':[_en_input, e => e.valueAsNumber]
, 'input,range':[_en_input, e => e.valueAsNumber]
, 'input,button':[_en_click, _e_value]
, 'input,submit':[_en_click, _e_value]
, 'input,checkbox':[_en_input, e => e.checked]
, 'input,radio':[_en_input, e => e.checked]
, 'input,date':[_en_input, e => e.valueAsDate]
, 'input,time':[_en_input, e => e.valueAsNumber]
, 'input,file':[_en_input, e => e.multiple ? e.files : e.files[0]]
, 'textarea':[_en_input, _e_value]
, 'select':{
      evt_names: _en_input
    , on_evt(e) {
        const res = Array.from(e.selectedOptions, _opt_unpack);
        return e.multiple ? res : res[0]} }

, 'form':{
      evt_names: _en_input
    , on_evt: e => new FormData(e)
    , on_add(e) {e.addEventListener('submit', _e_no_default);} } };


function _dom_builtin(std, elem) {
  let {tagName: tag, type} = elem;
  tag = tag.toLowerCase();

  const res =
    type && std[`${tag},${type.toLowerCase()}`]
    || std[tag] || std._;

  return Array.isArray(res)
    ?{elem, evt_names: res[0], on_evt: res[1]}
    :{elem, ... res} }


function _dom_unpack_args(std, elem, args) {
  if ('string' === typeof elem) {
    elem = document.querySelector(elem);}

  return args && args.length
    ?{elem, evt_names: args[0], on_evt: args[1]}
    : _dom_builtin(std, elem)}



const _dom_std_unpack_args = 
  _dom_unpack_args.bind(null, _dom_std_args);

function ao_dom(elem, ...args) {
  return _ao_dom_updates(
    _dom_std_unpack_args(elem, args)) }


function _ao_dom_updates({elem, evt_names, on_evt, on_calc, on_add, on_remove}) {
  if (!Array.isArray(evt_names)) {
    evt_names = (evt_names || 'click').split(/\s+/);}

  const extra = on_evt || {};
  if ('function' !== typeof on_evt) {
    on_evt = extra.on_evt;}

  return ao_update_ctx ((function * ( ao_update ) {
    const _update = on_evt
      ? evt => ao_update(on_evt(elem, evt))
      : ()=> ao_update(elem);

    if (extra.on_add) {
      extra.on_add(elem);}

    for (const e of evt_names) {
      elem.addEventListener(e, _update); }

    try {
      _update(elem);
      yield extra.on_calc;}

    finally {
      for (const e of evt_names) {
        elem.removeEventListener(e, _update); }

      if (extra.on_remove) {
        extra.on_remove(elem);} } }).bind(this)) }


function ao_animation_frames() {
  return ao_update_ctx ((function * ( ao_update ) {
    function _update(ts) {
      ao_update(ts);
      rid = requestAnimationFrame(_update); }

    let rid = requestAnimationFrame(_update);
    try {yield;}
    finally {cancelAnimationFrame(rid);} }).bind(this)) }

const delay = (...args) =>
  new Promise(y =>
    setTimeout(y, ...args) );

function ao_pulse(ms, immediate) {
  return ao_update_ctx ((function * ( ao_update ) {
    const ts0 = Date.now();
    function _pulse() {
      ao_update(Date.now() - ts0); }

    const tid = setInterval(_pulse, ms);
    try {
      if (immediate) {_pulse();}

      yield;}

    finally {
      clearInterval(tid); } }).bind(this)) }

export { _ao_deps_change, _ao_deps_map_updates, _ao_deps_vec_updates, _ao_dom_updates, _ao_iter_latest, _dom_builtin, _dom_std_args, _dom_std_unpack_args, _dom_unpack_args, ao_animation_frames, ao_deps_map, ao_deps_vec, ao_dom, ao_fence, ao_latest, ao_pulse, ao_push, ao_track, ao_track_entries, ao_track_kw, ao_track_vec, ao_update_ctx, ao_watch, as_ao_dep, as_ao_iter, as_ao_iter_checked, delay, is_ao_iterable, sym_ao, sym_ao_latest, sym_iter };
//# sourceMappingURL=index.mjs.map
