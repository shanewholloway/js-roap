(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.roap = {}));
}(this, (function (exports) { 'use strict';

  const sym_ao = Symbol.asyncIterator;
  const sym_iter = Symbol.iterator;

  async function * as_ao_iter(ao_iterable) {
    yield * ao_iterable;}

  function is_ao_iter(v) {
    return v !== undefined && v !== null
      && 'function' === typeof v[sym_ao]}

  function is_ao_iterable(v) {
    return v !== undefined && v !== null
      && 'string' !== typeof v
      && 'function' === typeof (v[sym_ao] || v.next || v[sym_iter])}

  function as_ao_iter_checked(ao_iterable) {
    if (! is_ao_iterable(ao_iterable)) {
      throw new TypeError('Expected an ao_iterable') }

    return as_ao_iter(ao_iterable)}

  const _ret_void = e => {};
  const _fn_true = ()=> true;
  const _ident = e => e;
  const _e_value = e => e.value;
  const _e_tip = e => e.tip;

  function as_fn$1(fn, absent) {
    if (! fn || true === fn) {
      return absent}
    if ('function' !== typeof fn) {
      throw new TypeError()}
    return fn}

  const deferred = ((() => {
    const _l=[], _lset = _l.splice.bind(_l, 1, 3);
    return host =>(
      _l[0] = new Promise(_lset)
    , _l) })());

  function ao_fence() {
    let _fp, _resume = _ret_void;
    const _set = y => _resume = y;
    return [fence, resume]

    function fence() {
      if (undefined === _fp) {
        _fp = new Promise(_set); }

      return _fp}

    function resume(v) {
      _fp = undefined;
      _resume(v);} }

  const sym_ao_latest = Symbol('ao_latest');


  async function * _ao_iter_latest(aod) {
    let _cur;
    while (true) {
      let _tip;
      while (_cur === (_tip = aod.tip)) {
        if (aod.done) {return}

        await aod.tail();}

      yield _cur = _tip;} }


  const __ao_latest__ ={
    xform: _ident

  , get [sym_ao_latest]() {
      return this}
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

  function ao_push(xform) {
    const [aod, ao_push] = ao_latest();
    if (undefined !== xform) {
      aod.xform = as_fn(xform);}

    ao_push.aod = aod;
    ao_push[sym_ao_latest] = aod;
    ao_push[sym_ao] = aod[sym_ao];
    return ao_push}



  function ao_watch(ao_iter) {
    ao_iter = as_ao_iter_checked(ao_iter);

    const [aod, ao_update] = ao_latest();
    ao_update.fin(ao_iter);
    aod.complete = _ao_walk(aod, ao_iter, ao_update);
    return aod}

  async function _ao_walk(ctrl, ao_iter, fn) {
    for await (const v of ao_iter) {
      await fn(v);
      if (ctrl.done) {return} } }



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


  async function _ao_deps_map_updates(ao_update, ...args) {
    const deps = await ao_deps_map(args.pop());
    const fence = args.shift() || _fn_true;
    while (true) {
      if (await fence()) {
        const snap = {};
        for (const [k, arg] of deps.entries()) {
          snap[k] = arg.tip;}

        ao_update(snap); }

      await _ao_deps_change(deps.values()); } }


  async function _ao_deps_vec_updates(ao_update, ...args) {
    const deps = await ao_deps_vec(args.pop());
    const fence = args.shift() || _fn_true;
    while (true) {
      if (await fence()) {
        const snap = Array.from(deps, _e_tip);

        ao_update(snap); }

      await _ao_deps_change(deps); } }

  function ao_track(...args) {
    const [aod, ao_update] = ao_latest();
    const deps = args.pop();
    if (Array.isArray(deps)) {
      args.push(deps);
      aod.complete = _ao_deps_vec_updates(ao_update, ... args); }

    else {
      args.push(Object.entries(deps));
      aod.complete = _ao_deps_map_updates(ao_update, ... args); }

    return aod}

  function ao_track_vec(...args) {
    const [aod, ao_update] = ao_latest();
    aod.complete = _ao_deps_vec_updates(ao_update, ...args);
    return aod}

  function ao_track_entries(...args) {
    const [aod, ao_update] = ao_latest();
    aod.complete = _ao_deps_map_updates(ao_update, ...args);
    return aod}

  function ao_track_kw(...args) {
    args.push(Object.entries(args.pop()));
    const [aod, ao_update] = ao_latest();
    aod.complete = _ao_deps_map_updates(ao_update, ...args);
    return aod}

  function ao_dyn() {
    let _ctrl = {};

    const [aod, ao_update] = ao_latest();
    aod.get = (() =>aod);
    aod.set = _dyn_set;
    return aod

    function _dyn_set(dyn_val) {
      _ctrl.done = true;

      if (is_ao_iter(dyn_val)) {
        _ctrl = {done: false};
        _ao_walk(_ctrl, dyn_val, ao_update);
        return true}

      else {
        ao_update(dyn_val);
        return true} } }


  function ao_dyn_ns(ns = new Map()) {
    return {
      has: k => ns.has(k)
    , get: k => ao_dyn_at(k).get()
    , set: (k, v) => ao_dyn_at(k).set(v)}

    function ao_dyn_at(k) {
      let ao = ns.get(k);
      if (undefined === ao) {
        ao = ao_dyn();
        ns.set(k, ao);}
      return ao} }


  function ao_dyn_obj(ns = new Map()) {
    return _ns_obj_proxy(ao_dyn_ns(ns)) }

  function _ns_obj_proxy(ns = new Map()) {
    return new Proxy({},{
      has: (ot, k) => ns.has(k)
    , get: (ot, k) => ns.get(k)
    , set: (ot, k, v) => ns.set(k, v)} ) }

  function _dom_unpack_args(std, elem, dom_args) {
    if ('string' === typeof elem) {
      elem = document.querySelector(elem);}

    return ! dom_args || 0 === dom_args.length
      ? _dom_builtin(std, elem)
      : _as_dom_arg(elem, dom_args)}


  function _dom_builtin(std, elem) {
    let {tagName: tag, type} = elem;
    tag = `tag:${tag.toLowerCase()}`;

    const dom_args = type && std[`${tag} type:${type.toLowerCase()}`]
        || std[tag]
        || std._;

    return 'function' === typeof dom_args
      ? dom_args.call(std, elem, std)
      : _as_dom_arg(elem, dom_args)}


  function _as_dom_arg(elem, dom_args) {
    return Array.isArray(dom_args)
      ?{elem, evt_names: dom_args[0], on_evt: dom_args[1]}
      :{elem, ... dom_args} }

  const _en_click = ['click'];
  const _en_input = ['input', 'change'];
  const _e_no_default = e => e.preventDefault();
  const _opt_unpack = ({text, value}) =>({text, value});


  const _dom_std_args ={
    _:[_en_click]
  , 'tag:input':[_en_input, _e_value]
  , 'tag:output':[_en_input, _e_value]
  , 'tag:input type:number':[_en_input, e => e.valueAsNumber]
  , 'tag:input type:range':[_en_input, e => e.valueAsNumber]
  , 'tag:input type:button':[_en_click, _e_value]
  , 'tag:input type:submit':[_en_click, _e_value]
  , 'tag:input type:checkbox':[_en_input, e => e.checked]
  , 'tag:input type:radio':[_en_input, e => e.checked]
  , 'tag:input type:date':[_en_input, e => e.valueAsDate]
  , 'tag:input type:time':[_en_input, e => e.valueAsNumber]
  , 'tag:input type:file':[_en_input, e => e.multiple ? e.files : e.files[0]]
  , 'tag:textarea':[_en_input, _e_value]
  , 'tag:select':{
        evt_names: _en_input
      , on_evt(e) {
          const res = Array.from(e.selectedOptions, _opt_unpack);
          return e.multiple ? res : res[0]} }

  , 'tag:form':{
        evt_names: _en_input
      , on_evt: e => new FormData(e)
      , on_add(e) {e.addEventListener('submit', _e_no_default);} } };


  const _dom_std_unpack_args = 
    _dom_unpack_args.bind(null, _dom_std_args);

  function ao_dom_updates({elem, evt_names, on_evt, on_calc, on_add, on_remove}) {
    if (! Array.isArray(evt_names)) {
      evt_names = (evt_names || 'click').split(/\s+/);}

    const extra = on_evt || {};
    if ('function' !== typeof on_evt) {
      on_evt = 'string' === typeof on_evt 
        ? fn_getter(on_evt)
        : as_fn$1(extra.on_evt, _ident);}

    return ao_update_ctx ((function * ( ao_update ) {
      function _update(evt) {
        evt = on_evt(elem, evt, ao_update);
        if (undefined !== evt) {
          ao_update(evt);} }

      if (extra.on_add) {
        extra.on_add(elem);}

      for (const e of evt_names) {
        elem.addEventListener(e, _update); }

      try {
        _update({});
        yield extra.on_calc;}

      finally {
        for (const e of evt_names) {
          elem.removeEventListener(e, _update); }

        if (extra.on_remove) {
          extra.on_remove(elem);} } }).bind(this)) }

  function ao_dom(elem, ...args) {
    return ao_dom_updates(
      _dom_std_unpack_args(elem, args)) }


  function ao_animation_frames() {
    return ao_update_ctx ((function * ( ao_update ) {
      function _update(ts) {
        ao_update(ts);
        rid = requestAnimationFrame(_update); }

      let rid = requestAnimationFrame(_update);
      try {yield;}
      finally {cancelAnimationFrame(rid);} }).bind(this)) }


  function ao_dom_storage() {
    return ao_update_ctx ((function * ( ao_update ) {
      function _on_stg({storageArea:sa, key:k, newValue:v, url}) {
        if (undefined === sa) {return}
        const entry =[k, v];
        entry.url = url;
        ao_update(entry);}

      window.addEventListener('storage', _on_stg);
      try {yield;}
      finally {
        window.removeEventListener('storage', _on_stg); } }).bind(this)) }


  function ao_dom_messages(msg_host, xform=_ident) {
    return ao_update_ctx ((function * ( ao_update ) {
      msg_host.onmessage = data => ao_update(data);

      yield xform;}).bind(this)) }

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

  exports._ao_deps_change = _ao_deps_change;
  exports._ao_deps_map_updates = _ao_deps_map_updates;
  exports._ao_deps_vec_updates = _ao_deps_vec_updates;
  exports._ao_iter_latest = _ao_iter_latest;
  exports._ao_walk = _ao_walk;
  exports._dom_builtin = _dom_builtin;
  exports._dom_std_args = _dom_std_args;
  exports._dom_std_unpack_args = _dom_std_unpack_args;
  exports._dom_unpack_args = _dom_unpack_args;
  exports._ns_obj_proxy = _ns_obj_proxy;
  exports.ao_animation_frames = ao_animation_frames;
  exports.ao_deps_map = ao_deps_map;
  exports.ao_deps_vec = ao_deps_vec;
  exports.ao_dom = ao_dom;
  exports.ao_dom_messages = ao_dom_messages;
  exports.ao_dom_storage = ao_dom_storage;
  exports.ao_dom_updates = ao_dom_updates;
  exports.ao_dyn = ao_dyn;
  exports.ao_dyn_ns = ao_dyn_ns;
  exports.ao_dyn_obj = ao_dyn_obj;
  exports.ao_fence = ao_fence;
  exports.ao_latest = ao_latest;
  exports.ao_pulse = ao_pulse;
  exports.ao_push = ao_push;
  exports.ao_track = ao_track;
  exports.ao_track_entries = ao_track_entries;
  exports.ao_track_kw = ao_track_kw;
  exports.ao_track_vec = ao_track_vec;
  exports.ao_update_ctx = ao_update_ctx;
  exports.ao_watch = ao_watch;
  exports.as_ao_dep = as_ao_dep;
  exports.as_ao_iter = as_ao_iter;
  exports.as_ao_iter_checked = as_ao_iter_checked;
  exports.delay = delay;
  exports.is_ao_iter = is_ao_iter;
  exports.is_ao_iterable = is_ao_iterable;
  exports.sym_ao = sym_ao;
  exports.sym_ao_latest = sym_ao_latest;
  exports.sym_iter = sym_iter;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=index.js.map
