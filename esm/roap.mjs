const is_ao_iter = g =>
  null != g[Symbol.asyncIterator];

const is_ao_fn = v_fn =>
  'function' === typeof v_fn
    && ! is_ao_iter(v_fn);


const ao_done = Object.freeze({ao_done: true});
const ao_check_done = err => {
  if (err !== ao_done && err && !err.ao_done) {
    throw err}
  return true};


const _ag_copy = ({g_in}, ag_out) =>(
  undefined === g_in ? ag_out :(
    ag_out.g_in = g_in
  , ag_out) );

function ao_defer_ctx(as_res = (...args) => args) {
  let y,n,_pset = (a,b) => { y=a, n=b; };
  return p =>(
    p = new Promise(_pset)
  , as_res(p, y, n)) }

const ao_defer_v = /* #__PURE__ */ ao_defer_ctx();

const ao_defer = /* #__PURE__ */
  ao_defer_ctx((p,y,n) =>
    ({promise: p, resolve: y, reject: n}));

async function ao_run(gen_in) {
  for await (let v of gen_in) {} }


async function ao_drive(gen_in, gen_tgt, close_tgt) {
  if (is_ao_fn(gen_tgt)) {
    gen_tgt = gen_tgt();
    gen_tgt.next();}

  for await (let v of gen_in) {
    let {done} = await gen_tgt.next(v);
    if (done) {break} }

  if (close_tgt) {
    await gen_tgt.return();} }



function * iter(iterable) {
  return (yield * iterable)}

function ao_step_iter(iterable, or_more) {
  iterable = ao_iter(iterable);
  return {
    async * [Symbol.asyncIterator]() {
      do {
        let {value, done} = await iterable.next();
        if (done) {return value}
        yield value;}
      while (or_more) } } }


function step_iter(iterable, or_more) {
  iterable = iter(iterable);
  return {
    *[Symbol.iterator]() {
      do {
        let {value, done} = iterable.next();
        if (done) {return value}
        yield value;}
      while (or_more) } } }


async function * ao_iter(iterable) {
  return (yield * iterable)}


async function * _ao_iter_fenced(iterable, f_gate, initial=false) {
  let f = true === initial ? f_gate.fence() : initial;
  for await (let v of iterable) {
    await f;
    yield v;
    f = f_gate.fence();} }


const ao_iter_fenced = (...args) =>
  _ag_copy(args[0], _ao_iter_fenced(...args));

function ao_fence_v(proto) {
  let reset = ao_defer_ctx(), x=reset(), p=0;

  let fence  = () =>(0 !== p ? p : p=(x=reset())[0]);
  let resume = ans => {p=0; x[1](ans);};
  let abort  = err => {p=0; x[2](err || ao_done);};

  return proto
    ?{__proto__: proto, fence, resume, abort}
    :[fence, resume, abort] }


async function * ao_iter_fence(fence) {
  try {
    while (1) {
      let r = await fence();
      if (undefined !== r) {
        yield r;} } }
  catch (err) {
    ao_check_done(err);} }



const _ao_fence_core_api_ = {
  ao_check_done

, // copyable fence fork api
  [Symbol.asyncIterator]() {
    return this.ao_fork()}

, ao_fork() {
    let ag = ao_iter_fence(this.fence);
    let {xemit} = this;
    return xemit ? xemit(ag) : ag} };


function ao_fence_fn(tgt) {
  let f = ao_fence_v();
  if (undefined === tgt) {tgt = f[0];}
  tgt.fence = Object.assign(tgt, _ao_fence_core_api_);
  return f}


const ao_fence_obj = /* #__PURE__ */
  ao_fence_v.bind(null, _ao_fence_core_api_);


function as_iter_proto(resume, abort, done = true) {
  return {
    next: v =>({value: resume(v), done})
  , return: () =>({value: abort(ao_done), done})
  , throw: (err) =>({value: abort(err), done}) } }

function ao_split(iterable) {
  let f_out = ao_fence_obj();
  f_out.when_run = _ao_run(iterable, f_out);
  f_out.g_in = iterable.g_in;
  return f_out}

async function _ao_run(iterable, f_tap) {
  try {
    for await (let v of iterable) {
      f_tap.resume(v);} }

  catch (err) {
    ao_check_done(err);}

  finally {
    f_tap.abort();} }


function ao_tap(iterable) {
  let f_tap = ao_fence_obj();
  let ag_tap = _ao_tap(iterable, f_tap);
  ag_tap.f_tap = ag_tap.f_out = f_tap;
  ag_tap.g_in = f_tap.g_in = iterable.g_in;
  return [f_tap, ag_tap]}

async function * _ao_tap(iterable, f_tap) {
  try {
    for await (let v of iterable) {
      f_tap.resume(v);
      yield v;} }

  catch (err) {
    ao_check_done(err);}

  finally {
    f_tap.abort();} }

const ao_fence_out = /* #__PURE__ */ ao_fence_v.bind(null,{
  __proto__: _ao_fence_core_api_

, [Symbol.asyncIterator]() {
    return this.ao_bound()}
, ao_bound() {
    throw new Error('ao_fence_out not bound')}
, _ao_many() {
    throw new Error('ao_fence_out consumed; consider .ao_fork() or .allow_many()')}

, allow_many() {
    let {ao_fork, ao_bound, _ao_many} = this;
    if (_ao_many === ao_bound) {
      this.ao_bound = ao_fork;}
    this._ao_many = ao_fork;
    this.allow_many = () => this;
    return this}

, ao_run() {
    let {when_run} = this;
    if (undefined === when_run) {
      this.when_run = when_run =
        ao_run(this.ao_bound()); }
    return when_run}

, bind_gated(f_gate) {
    let ag_out = this._ao_gated(f_gate);
    ag_out.f_out = this;
    ag_out.g_in = this.g_in;
    this.ao_bound = (() => {
      let {xemit, _ao_many} = this;
      this.ao_bound = _ao_many;
      return xemit
        ? _ag_copy(ag_out, xemit(ag_out))
        : ag_out});

    return this}

, ao_gated(f_gate) {
    return this.bind_gated(f_gate).ao_bound()}

, _ao_gated(f_gate) {return aog_gated(this, f_gate)} } );


async function * aog_gated(f_out, f_gate) {
  try {
    f_out.resume();
    while (1) {
      let v = await f_gate.fence();
      yield v;
      f_out.resume(v);} }
  catch (err) {
    ao_check_done(err);}
  finally {
    f_out.abort();
    if (f_gate.abort) {
      f_gate.abort();} } }

const ao_feeder = ({g_in}) => v => g_in.next(v);
const ao_feeder_v = ({g_in}) => (...args) => g_in.next(args);


function aog_fence_xf(xinit, ...args) {
  let f_in = ao_fence_v({}), f_out = ao_fence_v({});
  let g_in = xinit(f_in, f_out, ...args);
  g_in.next();

  let res = aog_gated(f_out, f_in);
  res.fence = f_out.fence;
  res.g_in = g_in;
  return res}

function ao_fence_iter(...args) {
  return aog_fence_xf(aog_iter, ...args)}

function ao_fence_sink(...args) {
  return aog_fence_xf(aog_sink, ...args)}


function * aog_iter(f_in, f_gate, xf) {
  try {
    while (1) {
      let tip = yield;
      if (undefined !== xf) {
        tip = (xf.next(tip)).value;}
      f_in.resume(tip);} }

  catch (err) {
    ao_check_done(err);}
  finally {
    f_in.abort();
    if (undefined !== xf) {
      xf.return();} } }


async function * aog_sink(f_in, f_gate, xf) {
  try {
    while (1) {
       {
        let tip = yield;
        if (undefined !== xf) {
          tip = (await xf.next(tip)).value;}
        f_in.resume(tip);}

      if (undefined !== f_gate) {
        await f_gate.fence();} } }

  catch (err) {
    ao_check_done(err);}
  finally {
    f_in.abort();
    if (undefined !== xf) {
      xf.return();} } }

const ao_xform = ns_gen => ao_fence_in().ao_xform(ns_gen);
const ao_fold = ns_gen => ao_fence_in().ao_fold(ns_gen);
const ao_queue = ns_gen => ao_fence_in().ao_queue(ns_gen);

const ao_fence_in = /* #__PURE__ */ ao_fence_v.bind(null,{
  __proto__: _ao_fence_core_api_

, ao_fold(ns_gen) {return this.ao_xform({xinit: aog_iter, ... ns_gen})}
, ao_queue(ns_gen) {return this.ao_xform({xinit: aog_sink, ... ns_gen})}

, aog_iter(xf) {return aog_iter(this)}
, aog_sink(f_gate, xf) {return aog_sink(this, f_gate, xf)}

, ao_xform(ns_gen={}) {
    let f_out = ao_fence_out();

    let {xemit, xinit, xrecv} =
      is_ao_fn(ns_gen)
        ? ns_gen(this, f_out)
        : ns_gen;

    if (undefined !== xemit) {
      f_out.xemit = xemit;}

    if (! xinit) {xinit = aog_sink;}
    let res = xinit(this, f_out,
      xrecv ? _xf_gen.create(xrecv) : undefined);

    let g_in = f_out.g_in = res.g_in || res;
    return res !== g_in
      ? res // res is an output generator
      :(// res is an input generator
          g_in.next(),
          f_out.bind_gated(this)) }

, // ES2015 generator api
  next(v) {return {value: this.resume(v), done: true}}
, return() {return {value: this.abort(ao_done), done: true}}
, throw(err) {return {value: this.abort(err), done: true}} } );


const _xf_gen = {
  create(xf) {
    let self = {__proto__: this};
    self.xg = xf(self.xf_inv());
    return self}

, *xf_inv() {
    while (1) {
      let tip = this._tip;
      if (this === tip) {
        throw new Error('Underflow')}
      else this._tip = this;

      yield tip;} }

, next(v) {
    this._tip = v;
    return this.xg.next(v)}

, return() {this.xg.return();}
, throw() {this.xg.throw();} };

function ao_push_stream() {
  let [fence, resume, abort] = ao_fence_v();
  let q=[], res = ao_stream_fence(fence);
  res.push = o => (q.push(o), resume(q), q.length);
  res.abort = abort;
  return res}


async function * ao_stream_fence(fence) {
  try {
    let p_ready = fence();
    while (1) {
      let batch = await p_ready;
      batch = batch.splice(0, batch.length);

      p_ready = fence();
      yield * batch;} }

  catch (err) {
    ao_check_done(err);} }

function ao_interval(ms=1000) {
  let [_fence, _resume, _abort] = ao_fence_fn();
  let tid = setInterval(_resume, ms, 1);
  if (tid.unref) {tid.unref();}
  _fence.stop = (() => {
    tid = clearInterval(tid);
    _abort();});

  return _fence}


function ao_timeout(ms=1000) {
  let tid, [_fence, _resume] = ao_fence_fn(timeout);
  return timeout

  function timeout() {
    tid = setTimeout(_resume, ms, 1);
    if (tid.unref) {tid.unref();}
    return _fence()} }


function ao_debounce(ms=300, ao_iterable) {
  let tid, [_fence, _resume] = ao_fence_fn();

  _fence.when_run = ((async () => {
    try {
      let p;
      for await (let v of ao_iterable) {
        clearTimeout(tid);
        p = _fence();
        tid = setTimeout(_resume, ms, v);}

      await p;}
    catch (err) {
      ao_check_done(err);} })());

  return _fence}


async function * ao_times(ao_iterable) {
  let ts0 = Date.now();
  for await (let v of ao_iterable) {
    yield Date.now() - ts0;} }

function ao_dom_animation() {
  let tid, [_fence, _resume] = ao_fence_fn(raf);
  raf.stop = (() => {
    tid = cancelAnimationFrame(tid);
    raf.done = true;});

  return raf

  function raf() {
    tid = requestAnimationFrame(_resume);
    return _fence()} }

const _evt_init = Promise.resolve({type:'init'});
function ao_dom_listen(self=ao_queue()) {
  return _bind.self = self ={
    __proto__: self
  , with_dom(dom, fn) {
      return dom.addEventListener
        ? _ao_with_dom(_bind, fn, dom)
        : _ao_with_dom_vec(_bind, fn, dom)} }

  function _bind(dom, fn_evt, fn_dom) {
    return evt => {
      let v = fn_evt
        ? fn_evt(evt, dom, fn_dom)
        : fn_dom(dom, evt);

      if (null != v) {
        self.g_in.next(v);} } } }


function _ao_with_dom(_bind, fn, dom) {
  let _on_evt;
  if (is_ao_fn(fn)) {
    _evt_init.then(
      _on_evt = _bind(dom, void 0, fn)); }

  return {
    __proto__: _bind.self
  , listen(...args) {
      let opt, evt_fn = _on_evt;

      let last = args.pop();
      if ('function' === typeof last) {
        evt_fn = _bind(dom, last, _on_evt);
        last = args.pop();}

      if ('string' === typeof last) {
        args.push(last);}
      else opt = last;

      for (let evt of args) {
        dom.addEventListener(
          evt, evt_fn, opt); }

      return this} } }


function _ao_with_dom_vec(_bind, fn, ectx_list) {
  ectx_list = Array.from(ectx_list,
    dom => _ao_with_dom(_bind, fn, dom));

  return {
    __proto__: _bind.self
  , listen(...args) {
      for (let ectx of ectx_list) {
        ectx.listen(...args);}
      return this} } }

export { _ag_copy, _ao_fence_core_api_, _ao_iter_fenced, _ao_run, _ao_tap, ao_check_done, ao_debounce, ao_defer, ao_defer_ctx, ao_defer_v, ao_dom_animation, ao_dom_listen, ao_done, ao_drive, ao_feeder, ao_feeder_v, ao_fence_fn, ao_fence_in, ao_fence_iter, ao_fence_obj, ao_fence_out, ao_fence_sink, ao_fence_v, ao_fold, ao_interval, ao_iter, ao_iter_fence, ao_iter_fenced, ao_push_stream, ao_queue, ao_run, ao_split, ao_step_iter, ao_stream_fence, ao_tap, ao_timeout, ao_times, ao_xform, aog_fence_xf, aog_gated, aog_iter, aog_sink, as_iter_proto, is_ao_fn, is_ao_iter, iter, step_iter };
//# sourceMappingURL=roap.mjs.map
