import "./chunk-BUSYA2B4.js";

// node_modules/@mediapipe/tasks-vision/vision_bundle.mjs
var t = "undefined" != typeof self ? self : {};
function e(e2, n2) {
  t: {
    for (var r2 = ["CLOSURE_FLAGS"], i2 = t, s2 = 0; s2 < r2.length; s2++) if (null == (i2 = i2[r2[s2]])) {
      r2 = null;
      break t;
    }
    r2 = i2;
  }
  return null != (e2 = r2 && r2[e2]) ? e2 : n2;
}
function n() {
  throw Error("Invalid UTF8");
}
function r(t2, e2) {
  return e2 = String.fromCharCode.apply(null, e2), null == t2 ? e2 : t2 + e2;
}
var i;
var s;
var o = "undefined" != typeof TextDecoder;
var a;
var c = "undefined" != typeof TextEncoder;
function h(t2) {
  if (c) t2 = (a ||= new TextEncoder()).encode(t2);
  else {
    let n2 = 0;
    const r2 = new Uint8Array(3 * t2.length);
    for (let i2 = 0; i2 < t2.length; i2++) {
      var e2 = t2.charCodeAt(i2);
      if (e2 < 128) r2[n2++] = e2;
      else {
        if (e2 < 2048) r2[n2++] = e2 >> 6 | 192;
        else {
          if (e2 >= 55296 && e2 <= 57343) {
            if (e2 <= 56319 && i2 < t2.length) {
              const s2 = t2.charCodeAt(++i2);
              if (s2 >= 56320 && s2 <= 57343) {
                e2 = 1024 * (e2 - 55296) + s2 - 56320 + 65536, r2[n2++] = e2 >> 18 | 240, r2[n2++] = e2 >> 12 & 63 | 128, r2[n2++] = e2 >> 6 & 63 | 128, r2[n2++] = 63 & e2 | 128;
                continue;
              }
              i2--;
            }
            e2 = 65533;
          }
          r2[n2++] = e2 >> 12 | 224, r2[n2++] = e2 >> 6 & 63 | 128;
        }
        r2[n2++] = 63 & e2 | 128;
      }
    }
    t2 = n2 === r2.length ? r2 : r2.subarray(0, n2);
  }
  return t2;
}
function u(e2) {
  t.setTimeout((() => {
    throw e2;
  }), 0);
}
var l;
var f = e(610401301, false);
var d = e(748402147, true);
var p = e(824648567, true);
var g = e(824656860, e(1, true));
function m() {
  var e2 = t.navigator;
  return e2 && (e2 = e2.userAgent) ? e2 : "";
}
var y = t.navigator;
function _(t2) {
  return _[" "](t2), t2;
}
l = y && y.userAgentData || null, _[" "] = function() {
};
var v = {};
var E = null;
function w(t2) {
  const e2 = t2.length;
  let n2 = 3 * e2 / 4;
  n2 % 3 ? n2 = Math.floor(n2) : -1 != "=.".indexOf(t2[e2 - 1]) && (n2 = -1 != "=.".indexOf(t2[e2 - 2]) ? n2 - 2 : n2 - 1);
  const r2 = new Uint8Array(n2);
  let i2 = 0;
  return (function(t3, e3) {
    function n3(e4) {
      for (; r3 < t3.length; ) {
        const e5 = t3.charAt(r3++), n4 = E[e5];
        if (null != n4) return n4;
        if (!/^[\s\xa0]*$/.test(e5)) throw Error("Unknown base64 encoding at char: " + e5);
      }
      return e4;
    }
    T();
    let r3 = 0;
    for (; ; ) {
      const t4 = n3(-1), r4 = n3(0), i3 = n3(64), s2 = n3(64);
      if (64 === s2 && -1 === t4) break;
      e3(t4 << 2 | r4 >> 4), 64 != i3 && (e3(r4 << 4 & 240 | i3 >> 2), 64 != s2 && e3(i3 << 6 & 192 | s2));
    }
  })(t2, (function(t3) {
    r2[i2++] = t3;
  })), i2 !== n2 ? r2.subarray(0, i2) : r2;
}
function T() {
  if (!E) {
    E = {};
    var t2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(""), e2 = ["+/=", "+/", "-_=", "-_.", "-_"];
    for (let n2 = 0; n2 < 5; n2++) {
      const r2 = t2.concat(e2[n2].split(""));
      v[n2] = r2;
      for (let t3 = 0; t3 < r2.length; t3++) {
        const e3 = r2[t3];
        void 0 === E[e3] && (E[e3] = t3);
      }
    }
  }
}
var A = "undefined" != typeof Uint8Array;
var b = !(!(f && l && l.brands.length > 0) && (-1 != m().indexOf("Trident") || -1 != m().indexOf("MSIE"))) && "function" == typeof btoa;
var k = /[-_.]/g;
var S = { "-": "+", _: "/", ".": "=" };
function x(t2) {
  return S[t2] || "";
}
function L(t2) {
  if (!b) return w(t2);
  t2 = k.test(t2) ? t2.replace(k, x) : t2, t2 = atob(t2);
  const e2 = new Uint8Array(t2.length);
  for (let n2 = 0; n2 < t2.length; n2++) e2[n2] = t2.charCodeAt(n2);
  return e2;
}
function R(t2) {
  return A && null != t2 && t2 instanceof Uint8Array;
}
var I = {};
function F() {
  return C ||= new P(null, I);
}
function M(t2) {
  N(I);
  var e2 = t2.g;
  return null == (e2 = null == e2 || R(e2) ? e2 : "string" == typeof e2 ? L(e2) : null) ? e2 : t2.g = e2;
}
var P = class {
  h() {
    return new Uint8Array(M(this) || 0);
  }
  constructor(t2, e2) {
    if (N(e2), this.g = t2, null != t2 && 0 === t2.length) throw Error("ByteString should be constructed with non-empty values");
  }
};
var C;
var O;
function N(t2) {
  if (t2 !== I) throw Error("illegal external caller");
}
function U(t2, e2) {
  t2.__closure__error__context__984382 || (t2.__closure__error__context__984382 = {}), t2.__closure__error__context__984382.severity = e2;
}
function D(t2) {
  return U(t2 = Error(t2), "warning"), t2;
}
function B(t2, e2) {
  if (null != t2) {
    var n2 = O ??= {}, r2 = n2[t2] || 0;
    r2 >= e2 || (n2[t2] = r2 + 1, U(t2 = Error(), "incident"), u(t2));
  }
}
function G() {
  return "function" == typeof BigInt;
}
var j = "function" == typeof Symbol && "symbol" == typeof /* @__PURE__ */ Symbol();
function V(t2, e2, n2 = false) {
  return "function" == typeof Symbol && "symbol" == typeof /* @__PURE__ */ Symbol() ? n2 && Symbol.for && t2 ? Symbol.for(t2) : null != t2 ? Symbol(t2) : /* @__PURE__ */ Symbol() : e2;
}
var X = V("jas", void 0, true);
var H = V(void 0, "0di");
var W = V(void 0, "1oa");
var z = V(void 0, /* @__PURE__ */ Symbol());
var K = V(void 0, "0ub");
var Y = V(void 0, "0ubs");
var q = V(void 0, "0ubsb");
var $ = V(void 0, "0actk");
var J = V("m_m", "Pa", true);
var Z = V();
var Q = { Ga: { value: 0, configurable: true, writable: true, enumerable: false } };
var tt = Object.defineProperties;
var et = j ? X : "Ga";
var nt;
var rt = [];
function it(t2, e2) {
  j || et in t2 || tt(t2, Q), t2[et] |= e2;
}
function st(t2, e2) {
  j || et in t2 || tt(t2, Q), t2[et] = e2;
}
function ot(t2) {
  return it(t2, 34), t2;
}
function at(t2) {
  return it(t2, 8192), t2;
}
st(rt, 7), nt = Object.freeze(rt);
var ct = {};
function ht(t2, e2) {
  return void 0 === e2 ? t2.h !== ut && !!(2 & (0 | t2.v[et])) : !!(2 & e2) && t2.h !== ut;
}
var ut = {};
function lt(t2, e2) {
  if (null != t2) {
    if ("string" == typeof t2) t2 = t2 ? new P(t2, I) : F();
    else if (t2.constructor !== P) if (R(t2)) t2 = t2.length ? new P(new Uint8Array(t2), I) : F();
    else {
      if (!e2) throw Error();
      t2 = void 0;
    }
  }
  return t2;
}
var ft = class {
  constructor(t2, e2, n2) {
    this.g = t2, this.h = e2, this.l = n2;
  }
  next() {
    const t2 = this.g.next();
    return t2.done || (t2.value = this.h.call(this.l, t2.value)), t2;
  }
  [Symbol.iterator]() {
    return this;
  }
};
var dt = Object.freeze({});
function pt(t2, e2, n2) {
  const r2 = 128 & e2 ? 0 : -1, i2 = t2.length;
  var s2;
  (s2 = !!i2) && (s2 = null != (s2 = t2[i2 - 1]) && "object" == typeof s2 && s2.constructor === Object);
  const o2 = i2 + (s2 ? -1 : 0);
  for (e2 = 128 & e2 ? 1 : 0; e2 < o2; e2++) n2(e2 - r2, t2[e2]);
  if (s2) {
    t2 = t2[i2 - 1];
    for (const e3 in t2) !isNaN(e3) && n2(+e3, t2[e3]);
  }
}
var gt = {};
function mt(t2) {
  return 128 & t2 ? gt : void 0;
}
function yt(t2) {
  return t2.Na = true, t2;
}
var _t = yt(((t2) => "number" == typeof t2));
var vt = yt(((t2) => "string" == typeof t2));
var Et = yt(((t2) => "boolean" == typeof t2));
var wt = "function" == typeof t.BigInt && "bigint" == typeof t.BigInt(0);
function Tt(t2) {
  var e2 = t2;
  if (vt(e2)) {
    if (!/^\s*(?:-?[1-9]\d*|0)?\s*$/.test(e2)) throw Error(String(e2));
  } else if (_t(e2) && !Number.isSafeInteger(e2)) throw Error(String(e2));
  return wt ? BigInt(t2) : t2 = Et(t2) ? t2 ? "1" : "0" : vt(t2) ? t2.trim() || "0" : String(t2);
}
var At = yt(((t2) => wt ? t2 >= kt && t2 <= xt : "-" === t2[0] ? Lt(t2, bt) : Lt(t2, St)));
var bt = Number.MIN_SAFE_INTEGER.toString();
var kt = wt ? BigInt(Number.MIN_SAFE_INTEGER) : void 0;
var St = Number.MAX_SAFE_INTEGER.toString();
var xt = wt ? BigInt(Number.MAX_SAFE_INTEGER) : void 0;
function Lt(t2, e2) {
  if (t2.length > e2.length) return false;
  if (t2.length < e2.length || t2 === e2) return true;
  for (let n2 = 0; n2 < t2.length; n2++) {
    const r2 = t2[n2], i2 = e2[n2];
    if (r2 > i2) return false;
    if (r2 < i2) return true;
  }
}
var Rt = "function" == typeof Uint8Array.prototype.slice;
var It;
var Ft = 0;
var Mt = 0;
function Pt(t2) {
  const e2 = t2 >>> 0;
  Ft = e2, Mt = (t2 - e2) / 4294967296 >>> 0;
}
function Ct(t2) {
  if (t2 < 0) {
    Pt(-t2);
    const [e2, n2] = Ht(Ft, Mt);
    Ft = e2 >>> 0, Mt = n2 >>> 0;
  } else Pt(t2);
}
function Ot(t2) {
  const e2 = It ||= new DataView(new ArrayBuffer(8));
  e2.setFloat32(0, +t2, true), Mt = 0, Ft = e2.getUint32(0, true);
}
function Nt(t2, e2) {
  const n2 = 4294967296 * e2 + (t2 >>> 0);
  return Number.isSafeInteger(n2) ? n2 : Gt(t2, e2);
}
function Ut(t2, e2) {
  return Tt(G() ? BigInt.asUintN(64, (BigInt(e2 >>> 0) << BigInt(32)) + BigInt(t2 >>> 0)) : Gt(t2, e2));
}
function Dt(t2, e2) {
  const n2 = 2147483648 & e2;
  return n2 && (e2 = ~e2 >>> 0, 0 == (t2 = 1 + ~t2 >>> 0) && (e2 = e2 + 1 >>> 0)), "number" == typeof (t2 = Nt(t2, e2)) ? n2 ? -t2 : t2 : n2 ? "-" + t2 : t2;
}
function Bt(t2, e2) {
  return G() ? Tt(BigInt.asIntN(64, (BigInt.asUintN(32, BigInt(e2)) << BigInt(32)) + BigInt.asUintN(32, BigInt(t2)))) : Tt(Vt(t2, e2));
}
function Gt(t2, e2) {
  if (t2 >>>= 0, (e2 >>>= 0) <= 2097151) var n2 = "" + (4294967296 * e2 + t2);
  else G() ? n2 = "" + (BigInt(e2) << BigInt(32) | BigInt(t2)) : (t2 = (16777215 & t2) + 6777216 * (n2 = 16777215 & (t2 >>> 24 | e2 << 8)) + 6710656 * (e2 = e2 >> 16 & 65535), n2 += 8147497 * e2, e2 *= 2, t2 >= 1e7 && (n2 += t2 / 1e7 >>> 0, t2 %= 1e7), n2 >= 1e7 && (e2 += n2 / 1e7 >>> 0, n2 %= 1e7), n2 = e2 + jt(n2) + jt(t2));
  return n2;
}
function jt(t2) {
  return t2 = String(t2), "0000000".slice(t2.length) + t2;
}
function Vt(t2, e2) {
  if (2147483648 & e2) if (G()) t2 = "" + (BigInt(0 | e2) << BigInt(32) | BigInt(t2 >>> 0));
  else {
    const [n2, r2] = Ht(t2, e2);
    t2 = "-" + Gt(n2, r2);
  }
  else t2 = Gt(t2, e2);
  return t2;
}
function Xt(t2) {
  if (t2.length < 16) Ct(Number(t2));
  else if (G()) t2 = BigInt(t2), Ft = Number(t2 & BigInt(4294967295)) >>> 0, Mt = Number(t2 >> BigInt(32) & BigInt(4294967295));
  else {
    const e2 = +("-" === t2[0]);
    Mt = Ft = 0;
    const n2 = t2.length;
    for (let r2 = e2, i2 = (n2 - e2) % 6 + e2; i2 <= n2; r2 = i2, i2 += 6) {
      const e3 = Number(t2.slice(r2, i2));
      Mt *= 1e6, Ft = 1e6 * Ft + e3, Ft >= 4294967296 && (Mt += Math.trunc(Ft / 4294967296), Mt >>>= 0, Ft >>>= 0);
    }
    if (e2) {
      const [t3, e3] = Ht(Ft, Mt);
      Ft = t3, Mt = e3;
    }
  }
}
function Ht(t2, e2) {
  return e2 = ~e2, t2 ? t2 = 1 + ~t2 : e2 += 1, [t2, e2];
}
function Wt(t2) {
  return Array.prototype.slice.call(t2);
}
var zt = "function" == typeof BigInt ? BigInt.asIntN : void 0;
var Kt = "function" == typeof BigInt ? BigInt.asUintN : void 0;
var Yt = Number.isSafeInteger;
var qt = Number.isFinite;
var $t = Math.trunc;
var Jt = Tt(0);
function Zt(t2) {
  if (null != t2 && "number" != typeof t2) throw Error(`Value of float/double field must be a number, found ${typeof t2}: ${t2}`);
  return t2;
}
function Qt(t2) {
  return null == t2 || "number" == typeof t2 ? t2 : "NaN" === t2 || "Infinity" === t2 || "-Infinity" === t2 ? Number(t2) : void 0;
}
function te(t2) {
  if (null != t2 && "boolean" != typeof t2) {
    var e2 = typeof t2;
    throw Error(`Expected boolean but got ${"object" != e2 ? e2 : t2 ? Array.isArray(t2) ? "array" : e2 : "null"}: ${t2}`);
  }
  return t2;
}
function ee(t2) {
  return null == t2 || "boolean" == typeof t2 ? t2 : "number" == typeof t2 ? !!t2 : void 0;
}
var ne = /^-?([1-9][0-9]*|0)(\.[0-9]+)?$/;
function re(t2) {
  switch (typeof t2) {
    case "bigint":
      return true;
    case "number":
      return qt(t2);
    case "string":
      return ne.test(t2);
    default:
      return false;
  }
}
function ie(t2) {
  if (null == t2) return t2;
  if ("string" == typeof t2 && t2) t2 = +t2;
  else if ("number" != typeof t2) return;
  return qt(t2) ? 0 | t2 : void 0;
}
function se(t2) {
  if (null == t2) return t2;
  if ("string" == typeof t2 && t2) t2 = +t2;
  else if ("number" != typeof t2) return;
  return qt(t2) ? t2 >>> 0 : void 0;
}
function oe(t2) {
  const e2 = t2.length;
  return ("-" === t2[0] ? e2 < 20 || 20 === e2 && t2 <= "-9223372036854775808" : e2 < 19 || 19 === e2 && t2 <= "9223372036854775807") ? t2 : (Xt(t2), Vt(Ft, Mt));
}
function ae(t2) {
  return t2 = $t(t2), Yt(t2) || (Ct(t2), t2 = Dt(Ft, Mt)), t2;
}
function ce(t2) {
  var e2 = $t(Number(t2));
  return Yt(e2) ? String(e2) : (-1 !== (e2 = t2.indexOf(".")) && (t2 = t2.substring(0, e2)), oe(t2));
}
function he(t2) {
  var e2 = $t(Number(t2));
  return Yt(e2) ? Tt(e2) : (-1 !== (e2 = t2.indexOf(".")) && (t2 = t2.substring(0, e2)), G() ? Tt(zt(64, BigInt(t2))) : Tt(oe(t2)));
}
function ue(t2) {
  return Yt(t2) ? t2 = Tt(ae(t2)) : (t2 = $t(t2), Yt(t2) ? t2 = String(t2) : (Ct(t2), t2 = Vt(Ft, Mt)), t2 = Tt(t2)), t2;
}
function le(t2) {
  return null == t2 ? t2 : "bigint" == typeof t2 ? (At(t2) ? t2 = Number(t2) : (t2 = zt(64, t2), t2 = At(t2) ? Number(t2) : String(t2)), t2) : re(t2) ? "number" == typeof t2 ? ae(t2) : ce(t2) : void 0;
}
function fe(t2) {
  const e2 = typeof t2;
  return null == t2 ? t2 : "bigint" === e2 ? Tt(zt(64, t2)) : re(t2) ? "string" === e2 ? he(t2) : ue(t2) : void 0;
}
function de(t2) {
  if ("string" != typeof t2) throw Error();
  return t2;
}
function pe(t2) {
  if (null != t2 && "string" != typeof t2) throw Error();
  return t2;
}
function ge(t2) {
  return null == t2 || "string" == typeof t2 ? t2 : void 0;
}
function me(t2, e2, n2, r2) {
  return null != t2 && t2[J] === ct ? t2 : Array.isArray(t2) ? ((r2 = (n2 = 0 | t2[et]) | 32 & r2 | 2 & r2) !== n2 && st(t2, r2), new e2(t2)) : (n2 ? 2 & r2 ? ((t2 = e2[H]) || (ot((t2 = new e2()).v), t2 = e2[H] = t2), e2 = t2) : e2 = new e2() : e2 = void 0, e2);
}
function ye(t2, e2, n2) {
  if (e2) t: {
    if (!re(e2 = t2)) throw D("int64");
    switch (typeof e2) {
      case "string":
        e2 = he(e2);
        break t;
      case "bigint":
        e2 = Tt(zt(64, e2));
        break t;
      default:
        e2 = ue(e2);
    }
  }
  else e2 = fe(t2);
  return null == (t2 = e2) ? n2 ? Jt : void 0 : t2;
}
var _e = {};
var ve = (function() {
  try {
    return _(new class extends Map {
      constructor() {
        super();
      }
    }()), false;
  } catch {
    return true;
  }
})();
var Ee = class {
  constructor() {
    this.g = /* @__PURE__ */ new Map();
  }
  get(t2) {
    return this.g.get(t2);
  }
  set(t2, e2) {
    return this.g.set(t2, e2), this.size = this.g.size, this;
  }
  delete(t2) {
    return t2 = this.g.delete(t2), this.size = this.g.size, t2;
  }
  clear() {
    this.g.clear(), this.size = this.g.size;
  }
  has(t2) {
    return this.g.has(t2);
  }
  entries() {
    return this.g.entries();
  }
  keys() {
    return this.g.keys();
  }
  values() {
    return this.g.values();
  }
  forEach(t2, e2) {
    return this.g.forEach(t2, e2);
  }
  [Symbol.iterator]() {
    return this.entries();
  }
};
var we = ve ? (Object.setPrototypeOf(Ee.prototype, Map.prototype), Object.defineProperties(Ee.prototype, { size: { value: 0, configurable: true, enumerable: true, writable: true } }), Ee) : class extends Map {
  constructor() {
    super();
  }
};
function Te(t2) {
  return t2;
}
function Ae(t2) {
  if (2 & t2.J) throw Error("Cannot mutate an immutable Map");
}
var be = class extends we {
  constructor(t2, e2, n2 = Te, r2 = Te) {
    super(), this.J = 0 | t2[et], this.K = e2, this.S = n2, this.fa = this.K ? ke : r2;
    for (let i2 = 0; i2 < t2.length; i2++) {
      const s2 = t2[i2], o2 = n2(s2[0], false, true);
      let a2 = s2[1];
      e2 ? void 0 === a2 && (a2 = null) : a2 = r2(s2[1], false, true, void 0, void 0, this.J), super.set(o2, a2);
    }
  }
  V(t2) {
    return at(Array.from(super.entries(), t2));
  }
  clear() {
    Ae(this), super.clear();
  }
  delete(t2) {
    return Ae(this), super.delete(this.S(t2, true, false));
  }
  entries() {
    if (this.K) {
      var t2 = super.keys();
      t2 = new ft(t2, Se, this);
    } else t2 = super.entries();
    return t2;
  }
  values() {
    if (this.K) {
      var t2 = super.keys();
      t2 = new ft(t2, be.prototype.get, this);
    } else t2 = super.values();
    return t2;
  }
  forEach(t2, e2) {
    this.K ? super.forEach(((n2, r2, i2) => {
      t2.call(e2, i2.get(r2), r2, i2);
    })) : super.forEach(t2, e2);
  }
  set(t2, e2) {
    return Ae(this), null == (t2 = this.S(t2, true, false)) ? this : null == e2 ? (super.delete(t2), this) : super.set(t2, this.fa(e2, true, true, this.K, false, this.J));
  }
  Ma(t2) {
    const e2 = this.S(t2[0], false, true);
    t2 = t2[1], t2 = this.K ? void 0 === t2 ? null : t2 : this.fa(t2, false, true, void 0, false, this.J), super.set(e2, t2);
  }
  has(t2) {
    return super.has(this.S(t2, false, false));
  }
  get(t2) {
    t2 = this.S(t2, false, false);
    const e2 = super.get(t2);
    if (void 0 !== e2) {
      var n2 = this.K;
      return n2 ? ((n2 = this.fa(e2, false, true, n2, this.ra, this.J)) !== e2 && super.set(t2, n2), n2) : e2;
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
};
function ke(t2, e2, n2, r2, i2, s2) {
  return t2 = me(t2, r2, n2, s2), i2 && (t2 = Ke(t2)), t2;
}
function Se(t2) {
  return [t2, this.get(t2)];
}
var xe;
function Le() {
  return xe ||= new be(ot([]), void 0, void 0, void 0, _e);
}
function Re(t2) {
  return z ? t2[z] : void 0;
}
function Ie(t2, e2) {
  for (const n2 in t2) !isNaN(n2) && e2(t2, +n2, t2[n2]);
}
be.prototype.toJSON = void 0;
var Fe = class {
};
var Me = { Ka: true };
function Pe(t2, e2) {
  e2 < 100 || B(Y, 1);
}
function Ce(t2, e2, n2, r2) {
  const i2 = void 0 !== r2;
  r2 = !!r2;
  var s2, o2 = z;
  !i2 && j && o2 && (s2 = t2[o2]) && Ie(s2, Pe), o2 = [];
  var a2 = t2.length;
  let c2;
  s2 = 4294967295;
  let h2 = false;
  const u2 = !!(64 & e2), l2 = u2 ? 128 & e2 ? 0 : -1 : void 0;
  1 & e2 || (c2 = a2 && t2[a2 - 1], null != c2 && "object" == typeof c2 && c2.constructor === Object ? s2 = --a2 : c2 = void 0, !u2 || 128 & e2 || i2 || (h2 = true, s2 = s2 - l2 + l2)), e2 = void 0;
  for (var f2 = 0; f2 < a2; f2++) {
    let i3 = t2[f2];
    if (null != i3 && null != (i3 = n2(i3, r2))) if (u2 && f2 >= s2) {
      const t3 = f2 - l2;
      (e2 ??= {})[t3] = i3;
    } else o2[f2] = i3;
  }
  if (c2) for (let t3 in c2) {
    if (null == (a2 = c2[t3]) || null == (a2 = n2(a2, r2))) continue;
    let i3;
    f2 = +t3, u2 && !Number.isNaN(f2) && (i3 = f2 + l2) < s2 ? o2[i3] = a2 : (e2 ??= {})[t3] = a2;
  }
  return e2 && (h2 ? o2.push(e2) : o2[s2] = e2), i2 && z && (t2 = Re(t2)) && t2 instanceof Fe && (o2[z] = (function(t3) {
    const e3 = new Fe();
    return Ie(t3, ((t4, n3, r3) => {
      e3[n3] = Wt(r3);
    })), e3.da = t3.da, e3;
  })(t2)), o2;
}
function Oe(t2) {
  return t2[0] = Ne(t2[0]), t2[1] = Ne(t2[1]), t2;
}
function Ne(t2) {
  switch (typeof t2) {
    case "number":
      return Number.isFinite(t2) ? t2 : "" + t2;
    case "bigint":
      return At(t2) ? Number(t2) : "" + t2;
    case "boolean":
      return t2 ? 1 : 0;
    case "object":
      if (Array.isArray(t2)) {
        var e2 = 0 | t2[et];
        return 0 === t2.length && 1 & e2 ? void 0 : Ce(t2, e2, Ne);
      }
      if (null != t2 && t2[J] === ct) return Ue(t2);
      if (t2 instanceof P) {
        if (null == (e2 = t2.g)) t2 = "";
        else if ("string" == typeof e2) t2 = e2;
        else {
          if (b) {
            for (var n2 = "", r2 = 0, i2 = e2.length - 10240; r2 < i2; ) n2 += String.fromCharCode.apply(null, e2.subarray(r2, r2 += 10240));
            n2 += String.fromCharCode.apply(null, r2 ? e2.subarray(r2) : e2), e2 = btoa(n2);
          } else {
            void 0 === n2 && (n2 = 0), T(), n2 = v[n2], r2 = Array(Math.floor(e2.length / 3)), i2 = n2[64] || "";
            let t3 = 0, h2 = 0;
            for (; t3 < e2.length - 2; t3 += 3) {
              var s2 = e2[t3], o2 = e2[t3 + 1], a2 = e2[t3 + 2], c2 = n2[s2 >> 2];
              s2 = n2[(3 & s2) << 4 | o2 >> 4], o2 = n2[(15 & o2) << 2 | a2 >> 6], a2 = n2[63 & a2], r2[h2++] = c2 + s2 + o2 + a2;
            }
            switch (c2 = 0, a2 = i2, e2.length - t3) {
              case 2:
                a2 = n2[(15 & (c2 = e2[t3 + 1])) << 2] || i2;
              case 1:
                e2 = e2[t3], r2[h2] = n2[e2 >> 2] + n2[(3 & e2) << 4 | c2 >> 4] + a2 + i2;
            }
            e2 = r2.join("");
          }
          t2 = t2.g = e2;
        }
        return t2;
      }
      return t2 instanceof be ? t2 = 0 !== t2.size ? t2.V(Oe) : void 0 : void 0;
  }
  return t2;
}
function Ue(t2) {
  return Ce(t2 = t2.v, 0 | t2[et], Ne);
}
var De;
var Be;
function Ge(t2, e2) {
  return je(t2, e2[0], e2[1]);
}
function je(t2, e2, n2, r2 = 0) {
  if (null == t2) {
    var i2 = 32;
    n2 ? (t2 = [n2], i2 |= 128) : t2 = [], e2 && (i2 = -16760833 & i2 | (1023 & e2) << 14);
  } else {
    if (!Array.isArray(t2)) throw Error("narr");
    if (i2 = 0 | t2[et], d && 1 & i2) throw Error("rfarr");
    if (2048 & i2 && !(2 & i2) && (function() {
      if (d) throw Error("carr");
      B($, 5);
    })(), 256 & i2) throw Error("farr");
    if (64 & i2) return (i2 | r2) !== i2 && st(t2, i2 | r2), t2;
    if (n2 && (i2 |= 128, n2 !== t2[0])) throw Error("mid");
    t: {
      i2 |= 64;
      var s2 = (n2 = t2).length;
      if (s2) {
        var o2 = s2 - 1;
        const t3 = n2[o2];
        if (null != t3 && "object" == typeof t3 && t3.constructor === Object) {
          if ((o2 -= e2 = 128 & i2 ? 0 : -1) >= 1024) throw Error("pvtlmt");
          for (var a2 in t3) (s2 = +a2) < o2 && (n2[s2 + e2] = t3[a2], delete t3[a2]);
          i2 = -16760833 & i2 | (1023 & o2) << 14;
          break t;
        }
      }
      if (e2) {
        if ((a2 = Math.max(e2, s2 - (128 & i2 ? 0 : -1))) > 1024) throw Error("spvt");
        i2 = -16760833 & i2 | (1023 & a2) << 14;
      }
    }
  }
  return st(t2, 64 | i2 | r2), t2;
}
function Ve(t2, e2) {
  if ("object" != typeof t2) return t2;
  if (Array.isArray(t2)) {
    var n2 = 0 | t2[et];
    return 0 === t2.length && 1 & n2 ? void 0 : Xe(t2, n2, e2);
  }
  if (null != t2 && t2[J] === ct) return We(t2);
  if (t2 instanceof be) {
    if (2 & (e2 = t2.J)) return t2;
    if (!t2.size) return;
    if (n2 = ot(t2.V()), t2.K) for (t2 = 0; t2 < n2.length; t2++) {
      const r2 = n2[t2];
      let i2 = r2[1];
      i2 = null == i2 || "object" != typeof i2 ? void 0 : null != i2 && i2[J] === ct ? We(i2) : Array.isArray(i2) ? Xe(i2, 0 | i2[et], !!(32 & e2)) : void 0, r2[1] = i2;
    }
    return n2;
  }
  return t2 instanceof P ? t2 : void 0;
}
function Xe(t2, e2, n2) {
  return 2 & e2 || (!n2 || 4096 & e2 || 16 & e2 ? t2 = ze(t2, e2, false, n2 && !(16 & e2)) : (it(t2, 34), 4 & e2 && Object.freeze(t2))), t2;
}
function He(t2, e2, n2) {
  return t2 = new t2.constructor(e2), n2 && (t2.h = ut), t2.m = ut, t2;
}
function We(t2) {
  const e2 = t2.v, n2 = 0 | e2[et];
  return ht(t2, n2) ? t2 : Je(t2, e2, n2) ? He(t2, e2) : ze(e2, n2);
}
function ze(t2, e2, n2, r2) {
  return r2 ??= !!(34 & e2), t2 = Ce(t2, e2, Ve, r2), r2 = 32, n2 && (r2 |= 2), st(t2, e2 = 16769217 & e2 | r2), t2;
}
function Ke(t2) {
  const e2 = t2.v, n2 = 0 | e2[et];
  return ht(t2, n2) ? Je(t2, e2, n2) ? He(t2, e2, true) : new t2.constructor(ze(e2, n2, false)) : t2;
}
function Ye(t2) {
  if (t2.h !== ut) return false;
  var e2 = t2.v;
  return it(e2 = ze(e2, 0 | e2[et]), 2048), t2.v = e2, t2.h = void 0, t2.m = void 0, true;
}
function qe(t2) {
  if (!Ye(t2) && ht(t2, 0 | t2.v[et])) throw Error();
}
function $e(t2, e2) {
  void 0 === e2 && (e2 = 0 | t2[et]), 32 & e2 && !(4096 & e2) && st(t2, 4096 | e2);
}
function Je(t2, e2, n2) {
  return !!(2 & n2) || !(!(32 & n2) || 4096 & n2) && (st(e2, 2 | n2), t2.h = ut, true);
}
var Ze = Tt(0);
var Qe = {};
function tn(t2, e2, n2, r2, i2) {
  if (null !== (e2 = en(t2.v, e2, n2, i2)) || r2 && t2.m !== ut) return e2;
}
function en(t2, e2, n2, r2) {
  if (-1 === e2) return null;
  const i2 = e2 + (n2 ? 0 : -1), s2 = t2.length - 1;
  let o2, a2;
  if (!(s2 < 1 + (n2 ? 0 : -1))) {
    if (i2 >= s2) if (o2 = t2[s2], null != o2 && "object" == typeof o2 && o2.constructor === Object) n2 = o2[e2], a2 = true;
    else {
      if (i2 !== s2) return;
      n2 = o2;
    }
    else n2 = t2[i2];
    if (r2 && null != n2) {
      if (null == (r2 = r2(n2))) return r2;
      if (!Object.is(r2, n2)) return a2 ? o2[e2] = r2 : t2[i2] = r2, r2;
    }
    return n2;
  }
}
function nn(t2, e2, n2, r2) {
  qe(t2), rn(t2 = t2.v, 0 | t2[et], e2, n2, r2);
}
function rn(t2, e2, n2, r2, i2) {
  const s2 = n2 + (i2 ? 0 : -1);
  var o2 = t2.length - 1;
  if (o2 >= 1 + (i2 ? 0 : -1) && s2 >= o2) {
    const i3 = t2[o2];
    if (null != i3 && "object" == typeof i3 && i3.constructor === Object) return i3[n2] = r2, e2;
  }
  return s2 <= o2 ? (t2[s2] = r2, e2) : (void 0 !== r2 && (n2 >= (o2 = (e2 ??= 0 | t2[et]) >> 14 & 1023 || 536870912) ? null != r2 && (t2[o2 + (i2 ? 0 : -1)] = { [n2]: r2 }) : t2[s2] = r2), e2);
}
function sn() {
  return void 0 === dt ? 2 : 4;
}
function on(t2, e2, n2, r2, i2) {
  let s2 = t2.v, o2 = 0 | s2[et];
  r2 = ht(t2, o2) ? 1 : r2, i2 = !!i2 || 3 === r2, 2 === r2 && Ye(t2) && (s2 = t2.v, o2 = 0 | s2[et]);
  let a2 = (t2 = cn(s2, e2)) === nt ? 7 : 0 | t2[et], c2 = hn(a2, o2);
  var h2 = !(4 & c2);
  if (h2) {
    4 & c2 && (t2 = Wt(t2), a2 = 0, c2 = xn(c2, o2), o2 = rn(s2, o2, e2, t2));
    let r3 = 0, i3 = 0;
    for (; r3 < t2.length; r3++) {
      const e3 = n2(t2[r3]);
      null != e3 && (t2[i3++] = e3);
    }
    i3 < r3 && (t2.length = i3), n2 = -513 & (4 | c2), c2 = n2 &= -1025, c2 &= -4097;
  }
  return c2 !== a2 && (st(t2, c2), 2 & c2 && Object.freeze(t2)), an(t2, c2, s2, o2, e2, r2, h2, i2);
}
function an(t2, e2, n2, r2, i2, s2, o2, a2) {
  let c2 = e2;
  return 1 === s2 || 4 === s2 && (2 & e2 || !(16 & e2) && 32 & r2) ? un(e2) || ((e2 |= !t2.length || o2 && !(4096 & e2) || 32 & r2 && !(4096 & e2 || 16 & e2) ? 2 : 256) !== c2 && st(t2, e2), Object.freeze(t2)) : (2 === s2 && un(e2) && (t2 = Wt(t2), c2 = 0, e2 = xn(e2, r2), r2 = rn(n2, r2, i2, t2)), un(e2) || (a2 || (e2 |= 16), e2 !== c2 && st(t2, e2))), 2 & e2 || !(4096 & e2 || 16 & e2) || $e(n2, r2), t2;
}
function cn(t2, e2, n2) {
  return t2 = en(t2, e2, n2), Array.isArray(t2) ? t2 : nt;
}
function hn(t2, e2) {
  return 2 & e2 && (t2 |= 2), 1 | t2;
}
function un(t2) {
  return !!(2 & t2) && !!(4 & t2) || !!(256 & t2);
}
function ln(t2) {
  return lt(t2, true);
}
function fn(t2) {
  t2 = Wt(t2);
  for (let e2 = 0; e2 < t2.length; e2++) {
    const n2 = t2[e2] = Wt(t2[e2]);
    Array.isArray(n2[1]) && (n2[1] = ot(n2[1]));
  }
  return at(t2);
}
function dn(t2, e2, n2, r2) {
  qe(t2), rn(t2 = t2.v, 0 | t2[et], e2, ("0" === r2 ? 0 === Number(n2) : n2 === r2) ? void 0 : n2);
}
function pn(t2, e2, n2) {
  if (2 & e2) throw Error();
  const r2 = mt(e2);
  let i2 = cn(t2, n2, r2), s2 = i2 === nt ? 7 : 0 | i2[et], o2 = hn(s2, e2);
  return (2 & o2 || un(o2) || 16 & o2) && (o2 === s2 || un(o2) || st(i2, o2), i2 = Wt(i2), s2 = 0, o2 = xn(o2, e2), rn(t2, e2, n2, i2, r2)), o2 &= -13, o2 !== s2 && st(i2, o2), i2;
}
function gn(t2, e2) {
  var n2 = Ds;
  return _n(mn(t2 = t2.v), t2, void 0, n2) === e2 ? e2 : -1;
}
function mn(t2) {
  if (j) return t2[W] ?? (t2[W] = /* @__PURE__ */ new Map());
  if (W in t2) return t2[W];
  const e2 = /* @__PURE__ */ new Map();
  return Object.defineProperty(t2, W, { value: e2 }), e2;
}
function yn(t2, e2, n2, r2, i2) {
  const s2 = mn(t2), o2 = _n(s2, t2, e2, n2, i2);
  return o2 !== r2 && (o2 && (e2 = rn(t2, e2, o2, void 0, i2)), s2.set(n2, r2)), e2;
}
function _n(t2, e2, n2, r2, i2) {
  let s2 = t2.get(r2);
  if (null != s2) return s2;
  s2 = 0;
  for (let t3 = 0; t3 < r2.length; t3++) {
    const o2 = r2[t3];
    null != en(e2, o2, i2) && (0 !== s2 && (n2 = rn(e2, n2, s2, void 0, i2)), s2 = o2);
  }
  return t2.set(r2, s2), s2;
}
function vn(t2, e2, n2) {
  let r2 = 0 | t2[et];
  const i2 = mt(r2), s2 = en(t2, n2, i2);
  let o2;
  if (null != s2 && s2[J] === ct) {
    if (!ht(s2)) return Ye(s2), s2.v;
    o2 = s2.v;
  } else Array.isArray(s2) && (o2 = s2);
  if (o2) {
    const t3 = 0 | o2[et];
    2 & t3 && (o2 = ze(o2, t3));
  }
  return o2 = Ge(o2, e2), o2 !== s2 && rn(t2, r2, n2, o2, i2), o2;
}
function En(t2, e2, n2, r2, i2) {
  let s2 = false;
  if (null != (r2 = en(t2, r2, i2, ((t3) => {
    const r3 = me(t3, n2, false, e2);
    return s2 = r3 !== t3 && null != r3, r3;
  })))) return s2 && !ht(r2) && $e(t2, e2), r2;
}
function wn(t2, e2, n2, r2) {
  let i2 = t2.v, s2 = 0 | i2[et];
  if (null == (e2 = En(i2, s2, e2, n2, r2))) return e2;
  if (s2 = 0 | i2[et], !ht(t2, s2)) {
    const o2 = Ke(e2);
    o2 !== e2 && (Ye(t2) && (i2 = t2.v, s2 = 0 | i2[et]), s2 = rn(i2, s2, n2, e2 = o2, r2), $e(i2, s2));
  }
  return e2;
}
function Tn(t2, e2, n2, r2, i2, s2, o2, a2) {
  var c2 = ht(t2, n2);
  s2 = c2 ? 1 : s2, o2 = !!o2 || 3 === s2, c2 = a2 && !c2, (2 === s2 || c2) && Ye(t2) && (n2 = 0 | (e2 = t2.v)[et]);
  var h2 = (t2 = cn(e2, i2)) === nt ? 7 : 0 | t2[et], u2 = hn(h2, n2);
  if (a2 = !(4 & u2)) {
    var l2 = t2, f2 = n2;
    const e3 = !!(2 & u2);
    e3 && (f2 |= 2);
    let i3 = !e3, s3 = true, o3 = 0, a3 = 0;
    for (; o3 < l2.length; o3++) {
      const t3 = me(l2[o3], r2, false, f2);
      if (t3 instanceof r2) {
        if (!e3) {
          const e4 = ht(t3);
          i3 &&= !e4, s3 &&= e4;
        }
        l2[a3++] = t3;
      }
    }
    a3 < o3 && (l2.length = a3), u2 |= 4, u2 = s3 ? -4097 & u2 : 4096 | u2, u2 = i3 ? 8 | u2 : -9 & u2;
  }
  if (u2 !== h2 && (st(t2, u2), 2 & u2 && Object.freeze(t2)), c2 && !(8 & u2 || !t2.length && (1 === s2 || 4 === s2 && (2 & u2 || !(16 & u2) && 32 & n2)))) {
    for (un(u2) && (t2 = Wt(t2), u2 = xn(u2, n2), n2 = rn(e2, n2, i2, t2)), r2 = t2, c2 = u2, h2 = 0; h2 < r2.length; h2++) (l2 = r2[h2]) !== (u2 = Ke(l2)) && (r2[h2] = u2);
    c2 |= 8, st(t2, u2 = c2 = r2.length ? 4096 | c2 : -4097 & c2);
  }
  return an(t2, u2, e2, n2, i2, s2, a2, o2);
}
function An(t2, e2, n2) {
  const r2 = t2.v;
  return Tn(t2, r2, 0 | r2[et], e2, n2, sn(), false, true);
}
function bn(t2) {
  return null == t2 && (t2 = void 0), t2;
}
function kn(t2, e2, n2, r2, i2) {
  return nn(t2, n2, r2 = bn(r2), i2), r2 && !ht(r2) && $e(t2.v), t2;
}
function Sn(t2, e2, n2, r2) {
  t: {
    var i2 = r2 = bn(r2);
    qe(t2);
    const s2 = t2.v;
    let o2 = 0 | s2[et];
    if (null == i2) {
      const t3 = mn(s2);
      if (_n(t3, s2, o2, n2) !== e2) break t;
      t3.set(n2, 0);
    } else o2 = yn(s2, o2, n2, e2);
    rn(s2, o2, e2, i2);
  }
  r2 && !ht(r2) && $e(t2.v);
}
function xn(t2, e2) {
  return -273 & (2 & e2 ? 2 | t2 : -3 & t2);
}
function Ln(t2, e2, n2, r2) {
  var i2 = r2;
  qe(t2), t2 = Tn(t2, r2 = t2.v, 0 | r2[et], n2, e2, 2, true), i2 = null != i2 ? i2 : new n2(), t2.push(i2), e2 = n2 = t2 === nt ? 7 : 0 | t2[et], (i2 = ht(i2)) ? (n2 &= -9, 1 === t2.length && (n2 &= -4097)) : n2 |= 4096, n2 !== e2 && st(t2, n2), i2 || $e(r2);
}
function Rn(t2, e2, n2) {
  return ie(tn(t2, e2, void 0, n2));
}
function In(t2) {
  return (g ? tn(t2, 2, void 0, void 0, fe) : fe(tn(t2, 2))) ?? Ze;
}
function Fn(t2, e2) {
  return tn(t2, e2, void 0, void 0, Qt) ?? 0;
}
function Mn(t2, e2, n2) {
  if (null != n2) {
    if ("number" != typeof n2) throw D("int32");
    if (!qt(n2)) throw D("int32");
    n2 |= 0;
  }
  nn(t2, e2, n2);
}
function Pn(t2, e2, n2) {
  nn(t2, e2, Zt(n2));
}
function Cn(t2, e2, n2) {
  dn(t2, e2, pe(n2), "");
}
function On(t2, e2, n2) {
  {
    qe(t2);
    const o2 = t2.v;
    let a2 = 0 | o2[et];
    if (null == n2) rn(o2, a2, e2);
    else {
      var r2 = t2 = n2 === nt ? 7 : 0 | n2[et], i2 = un(t2), s2 = i2 || Object.isFrozen(n2);
      for (i2 || (t2 = 0), s2 || (n2 = Wt(n2), r2 = 0, t2 = xn(t2, a2), s2 = false), t2 |= 5, t2 |= (4 & t2 ? 512 & t2 ? 512 : 1024 & t2 ? 1024 : 0 : void 0) ?? (g ? 1024 : 0), i2 = 0; i2 < n2.length; i2++) {
        const e3 = n2[i2], o3 = de(e3);
        Object.is(e3, o3) || (s2 && (n2 = Wt(n2), r2 = 0, t2 = xn(t2, a2), s2 = false), n2[i2] = o3);
      }
      t2 !== r2 && (s2 && (n2 = Wt(n2), t2 = xn(t2, a2)), st(n2, t2)), rn(o2, a2, e2, n2);
    }
  }
}
function Nn(t2, e2, n2) {
  qe(t2), on(t2, e2, ge, 2, true).push(de(n2));
}
var Un = class {
  constructor(t2, e2, n2) {
    if (this.buffer = t2, n2 && !e2) throw Error();
    this.g = e2;
  }
};
function Dn(t2, e2) {
  if ("string" == typeof t2) return new Un(L(t2), e2);
  if (Array.isArray(t2)) return new Un(new Uint8Array(t2), e2);
  if (t2.constructor === Uint8Array) return new Un(t2, false);
  if (t2.constructor === ArrayBuffer) return t2 = new Uint8Array(t2), new Un(t2, false);
  if (t2.constructor === P) return e2 = M(t2) || new Uint8Array(0), new Un(e2, true, t2);
  if (t2 instanceof Uint8Array) return t2 = t2.constructor === Uint8Array ? t2 : new Uint8Array(t2.buffer, t2.byteOffset, t2.byteLength), new Un(t2, false);
  throw Error();
}
function Bn(t2, e2) {
  let n2, r2 = 0, i2 = 0, s2 = 0;
  const o2 = t2.h;
  let a2 = t2.g;
  do {
    n2 = o2[a2++], r2 |= (127 & n2) << s2, s2 += 7;
  } while (s2 < 32 && 128 & n2);
  if (s2 > 32) for (i2 |= (127 & n2) >> 4, s2 = 3; s2 < 32 && 128 & n2; s2 += 7) n2 = o2[a2++], i2 |= (127 & n2) << s2;
  if (Wn(t2, a2), !(128 & n2)) return e2(r2 >>> 0, i2 >>> 0);
  throw Error();
}
function Gn(t2) {
  let e2 = 0, n2 = t2.g;
  const r2 = n2 + 10, i2 = t2.h;
  for (; n2 < r2; ) {
    const r3 = i2[n2++];
    if (e2 |= r3, 0 == (128 & r3)) return Wn(t2, n2), !!(127 & e2);
  }
  throw Error();
}
function jn(t2) {
  const e2 = t2.h;
  let n2 = t2.g, r2 = e2[n2++], i2 = 127 & r2;
  if (128 & r2 && (r2 = e2[n2++], i2 |= (127 & r2) << 7, 128 & r2 && (r2 = e2[n2++], i2 |= (127 & r2) << 14, 128 & r2 && (r2 = e2[n2++], i2 |= (127 & r2) << 21, 128 & r2 && (r2 = e2[n2++], i2 |= r2 << 28, 128 & r2 && 128 & e2[n2++] && 128 & e2[n2++] && 128 & e2[n2++] && 128 & e2[n2++] && 128 & e2[n2++]))))) throw Error();
  return Wn(t2, n2), i2;
}
function Vn(t2) {
  return jn(t2) >>> 0;
}
function Xn(t2) {
  var e2 = t2.h;
  const n2 = t2.g;
  var r2 = e2[n2], i2 = e2[n2 + 1];
  const s2 = e2[n2 + 2];
  return e2 = e2[n2 + 3], Wn(t2, t2.g + 4), t2 = 2 * ((i2 = (r2 << 0 | i2 << 8 | s2 << 16 | e2 << 24) >>> 0) >> 31) + 1, r2 = i2 >>> 23 & 255, i2 &= 8388607, 255 == r2 ? i2 ? NaN : t2 * (1 / 0) : 0 == r2 ? 1401298464324817e-60 * t2 * i2 : t2 * Math.pow(2, r2 - 150) * (i2 + 8388608);
}
function Hn(t2) {
  return jn(t2);
}
function Wn(t2, e2) {
  if (t2.g = e2, e2 > t2.l) throw Error();
}
function zn(t2, e2) {
  if (e2 < 0) throw Error();
  const n2 = t2.g;
  if ((e2 = n2 + e2) > t2.l) throw Error();
  return t2.g = e2, n2;
}
function Kn(t2, e2) {
  if (0 == e2) return F();
  var n2 = zn(t2, e2);
  return t2.Y && t2.j ? n2 = t2.h.subarray(n2, n2 + e2) : (t2 = t2.h, n2 = n2 === (e2 = n2 + e2) ? new Uint8Array(0) : Rt ? t2.slice(n2, e2) : new Uint8Array(t2.subarray(n2, e2))), 0 == n2.length ? F() : new P(n2, I);
}
var Yn = [];
function qn(t2, e2, n2, r2) {
  if (ir.length) {
    const i2 = ir.pop();
    return i2.o(r2), i2.g.init(t2, e2, n2, r2), i2;
  }
  return new rr(t2, e2, n2, r2);
}
function $n(t2) {
  t2.g.clear(), t2.l = -1, t2.h = -1, ir.length < 100 && ir.push(t2);
}
function Jn(t2) {
  var e2 = t2.g;
  if (e2.g == e2.l) return false;
  t2.m = t2.g.g;
  var n2 = Vn(t2.g);
  if (e2 = n2 >>> 3, !((n2 &= 7) >= 0 && n2 <= 5)) throw Error();
  if (e2 < 1) throw Error();
  return t2.l = e2, t2.h = n2, true;
}
function Zn(t2) {
  switch (t2.h) {
    case 0:
      0 != t2.h ? Zn(t2) : Gn(t2.g);
      break;
    case 1:
      Wn(t2 = t2.g, t2.g + 8);
      break;
    case 2:
      if (2 != t2.h) Zn(t2);
      else {
        var e2 = Vn(t2.g);
        Wn(t2 = t2.g, t2.g + e2);
      }
      break;
    case 5:
      Wn(t2 = t2.g, t2.g + 4);
      break;
    case 3:
      for (e2 = t2.l; ; ) {
        if (!Jn(t2)) throw Error();
        if (4 == t2.h) {
          if (t2.l != e2) throw Error();
          break;
        }
        Zn(t2);
      }
      break;
    default:
      throw Error();
  }
}
function Qn(t2, e2, n2) {
  const r2 = t2.g.l;
  var i2 = Vn(t2.g);
  let s2 = (i2 = t2.g.g + i2) - r2;
  if (s2 <= 0 && (t2.g.l = i2, n2(e2, t2, void 0, void 0, void 0), s2 = i2 - t2.g.g), s2) throw Error();
  return t2.g.g = i2, t2.g.l = r2, e2;
}
function tr(t2) {
  var e2 = Vn(t2.g), a2 = zn(t2 = t2.g, e2);
  if (t2 = t2.h, o) {
    var c2, h2 = t2;
    (c2 = s) || (c2 = s = new TextDecoder("utf-8", { fatal: true })), e2 = a2 + e2, h2 = 0 === a2 && e2 === h2.length ? h2 : h2.subarray(a2, e2);
    try {
      var u2 = c2.decode(h2);
    } catch (t3) {
      if (void 0 === i) {
        try {
          c2.decode(new Uint8Array([128]));
        } catch (t4) {
        }
        try {
          c2.decode(new Uint8Array([97])), i = true;
        } catch (t4) {
          i = false;
        }
      }
      throw !i && (s = void 0), t3;
    }
  } else {
    e2 = (u2 = a2) + e2, a2 = [];
    let i2, s2 = null;
    for (; u2 < e2; ) {
      var l2 = t2[u2++];
      l2 < 128 ? a2.push(l2) : l2 < 224 ? u2 >= e2 ? n() : (i2 = t2[u2++], l2 < 194 || 128 != (192 & i2) ? (u2--, n()) : a2.push((31 & l2) << 6 | 63 & i2)) : l2 < 240 ? u2 >= e2 - 1 ? n() : (i2 = t2[u2++], 128 != (192 & i2) || 224 === l2 && i2 < 160 || 237 === l2 && i2 >= 160 || 128 != (192 & (c2 = t2[u2++])) ? (u2--, n()) : a2.push((15 & l2) << 12 | (63 & i2) << 6 | 63 & c2)) : l2 <= 244 ? u2 >= e2 - 2 ? n() : (i2 = t2[u2++], 128 != (192 & i2) || i2 - 144 + (l2 << 28) >> 30 != 0 || 128 != (192 & (c2 = t2[u2++])) || 128 != (192 & (h2 = t2[u2++])) ? (u2--, n()) : (l2 = (7 & l2) << 18 | (63 & i2) << 12 | (63 & c2) << 6 | 63 & h2, l2 -= 65536, a2.push(55296 + (l2 >> 10 & 1023), 56320 + (1023 & l2)))) : n(), a2.length >= 8192 && (s2 = r(s2, a2), a2.length = 0);
    }
    u2 = r(s2, a2);
  }
  return u2;
}
function er(t2) {
  const e2 = Vn(t2.g);
  return Kn(t2.g, e2);
}
function nr(t2, e2, n2) {
  var r2 = Vn(t2.g);
  for (r2 = t2.g.g + r2; t2.g.g < r2; ) n2.push(e2(t2.g));
}
var rr = class {
  constructor(t2, e2, n2, r2) {
    if (Yn.length) {
      const i2 = Yn.pop();
      i2.init(t2, e2, n2, r2), t2 = i2;
    } else t2 = new class {
      constructor(t3, e3, n3, r3) {
        this.h = null, this.j = false, this.g = this.l = this.m = 0, this.init(t3, e3, n3, r3);
      }
      init(t3, e3, n3, { Y: r3 = false, ea: i2 = false } = {}) {
        this.Y = r3, this.ea = i2, t3 && (t3 = Dn(t3, this.ea), this.h = t3.buffer, this.j = t3.g, this.m = e3 || 0, this.l = void 0 !== n3 ? this.m + n3 : this.h.length, this.g = this.m);
      }
      clear() {
        this.h = null, this.j = false, this.g = this.l = this.m = 0, this.Y = false;
      }
    }(t2, e2, n2, r2);
    this.g = t2, this.m = this.g.g, this.h = this.l = -1, this.o(r2);
  }
  o({ ha: t2 = false } = {}) {
    this.ha = t2;
  }
};
var ir = [];
function sr(t2) {
  return t2 ? /^\d+$/.test(t2) ? (Xt(t2), new or(Ft, Mt)) : null : ar ||= new or(0, 0);
}
var or = class {
  constructor(t2, e2) {
    this.h = t2 >>> 0, this.g = e2 >>> 0;
  }
};
var ar;
function cr(t2) {
  return t2 ? /^-?\d+$/.test(t2) ? (Xt(t2), new hr(Ft, Mt)) : null : ur ||= new hr(0, 0);
}
var hr = class {
  constructor(t2, e2) {
    this.h = t2 >>> 0, this.g = e2 >>> 0;
  }
};
var ur;
function lr(t2, e2, n2) {
  for (; n2 > 0 || e2 > 127; ) t2.g.push(127 & e2 | 128), e2 = (e2 >>> 7 | n2 << 25) >>> 0, n2 >>>= 7;
  t2.g.push(e2);
}
function fr(t2, e2) {
  for (; e2 > 127; ) t2.g.push(127 & e2 | 128), e2 >>>= 7;
  t2.g.push(e2);
}
function dr(t2, e2) {
  if (e2 >= 0) fr(t2, e2);
  else {
    for (let n2 = 0; n2 < 9; n2++) t2.g.push(127 & e2 | 128), e2 >>= 7;
    t2.g.push(1);
  }
}
function pr(t2) {
  var e2 = Ft;
  t2.g.push(e2 >>> 0 & 255), t2.g.push(e2 >>> 8 & 255), t2.g.push(e2 >>> 16 & 255), t2.g.push(e2 >>> 24 & 255);
}
function gr(t2, e2) {
  0 !== e2.length && (t2.l.push(e2), t2.h += e2.length);
}
function mr(t2, e2, n2) {
  fr(t2.g, 8 * e2 + n2);
}
function yr(t2, e2) {
  return mr(t2, e2, 2), e2 = t2.g.end(), gr(t2, e2), e2.push(t2.h), e2;
}
function _r(t2, e2) {
  var n2 = e2.pop();
  for (n2 = t2.h + t2.g.length() - n2; n2 > 127; ) e2.push(127 & n2 | 128), n2 >>>= 7, t2.h++;
  e2.push(n2), t2.h++;
}
function vr(t2, e2, n2) {
  mr(t2, e2, 2), fr(t2.g, n2.length), gr(t2, t2.g.end()), gr(t2, n2);
}
function Er(t2, e2, n2, r2) {
  null != n2 && (e2 = yr(t2, e2), r2(n2, t2), _r(t2, e2));
}
function wr() {
  const t2 = class {
    constructor() {
      throw Error();
    }
  };
  return Object.setPrototypeOf(t2, t2.prototype), t2;
}
var Tr = wr();
var Ar = wr();
var br = wr();
var kr = wr();
var Sr = wr();
var xr = wr();
var Lr = wr();
var Rr = wr();
var Ir = wr();
var Fr = wr();
function Mr(t2, e2, n2) {
  var r2 = t2.v;
  z && z in r2 && (r2 = r2[z]) && delete r2[e2.g], e2.h ? e2.j(t2, e2.h, e2.g, n2, e2.l) : e2.j(t2, e2.g, n2, e2.l);
}
var Pr = class {
  constructor(t2, e2) {
    this.v = je(t2, e2, void 0, 2048);
  }
  toJSON() {
    return Ue(this);
  }
  j() {
    var t2 = Fo, e2 = this.v, n2 = t2.g, r2 = z;
    if (j && r2 && null != e2[r2]?.[n2] && B(K, 3), e2 = t2.g, Z && z && void 0 === Z && (r2 = (n2 = this.v)[z]) && (r2 = r2.da)) try {
      r2(n2, e2, Me);
    } catch (t3) {
      u(t3);
    }
    return t2.h ? t2.m(this, t2.h, t2.g, t2.l) : t2.m(this, t2.g, t2.defaultValue, t2.l);
  }
  clone() {
    const t2 = this.v, e2 = 0 | t2[et];
    return Je(this, t2, e2) ? He(this, t2, true) : new this.constructor(ze(t2, e2, false));
  }
};
Pr.prototype[J] = ct, Pr.prototype.toString = function() {
  return this.v.toString();
};
var Cr = class {
  constructor(t2, e2, n2) {
    this.g = t2, this.h = e2, t2 = Tr, this.l = !!t2 && n2 === t2 || false;
  }
};
function Or(t2, e2) {
  return new Cr(t2, e2, Tr);
}
function Nr(t2, e2, n2, r2, i2) {
  Er(t2, n2, Yr(e2, r2), i2);
}
var Ur = Or((function(t2, e2, n2, r2, i2) {
  return 2 === t2.h && (Qn(t2, vn(e2, r2, n2), i2), true);
}), Nr);
var Dr = Or((function(t2, e2, n2, r2, i2) {
  return 2 === t2.h && (Qn(t2, vn(e2, r2, n2), i2), true);
}), Nr);
var Br = /* @__PURE__ */ Symbol();
var Gr = /* @__PURE__ */ Symbol();
var jr = /* @__PURE__ */ Symbol();
var Vr = /* @__PURE__ */ Symbol();
var Xr = /* @__PURE__ */ Symbol();
var Hr;
var Wr;
function zr(t2, e2, n2, r2) {
  var i2 = r2[t2];
  if (i2) return i2;
  (i2 = {}).qa = r2, i2.T = (function(t3) {
    switch (typeof t3) {
      case "boolean":
        return De ||= [0, void 0, true];
      case "number":
        return t3 > 0 ? void 0 : 0 === t3 ? Be ||= [0, void 0] : [-t3, void 0];
      case "string":
        return [0, t3];
      case "object":
        return t3;
    }
  })(r2[0]);
  var s2 = r2[1];
  let o2 = 1;
  s2 && s2.constructor === Object && (i2.ba = s2, "function" == typeof (s2 = r2[++o2]) && (i2.ma = true, Hr ??= s2, Wr ??= r2[o2 + 1], s2 = r2[o2 += 2]));
  const a2 = {};
  for (; s2 && Array.isArray(s2) && s2.length && "number" == typeof s2[0] && s2[0] > 0; ) {
    for (var c2 = 0; c2 < s2.length; c2++) a2[s2[c2]] = s2;
    s2 = r2[++o2];
  }
  for (c2 = 1; void 0 !== s2; ) {
    let t3;
    "number" == typeof s2 && (c2 += s2, s2 = r2[++o2]);
    var h2 = void 0;
    if (s2 instanceof Cr ? t3 = s2 : (t3 = Ur, o2--), t3?.l) {
      s2 = r2[++o2], h2 = r2;
      var u2 = o2;
      "function" == typeof s2 && (s2 = s2(), h2[u2] = s2), h2 = s2;
    }
    for (u2 = c2 + 1, "number" == typeof (s2 = r2[++o2]) && s2 < 0 && (u2 -= s2, s2 = r2[++o2]); c2 < u2; c2++) {
      const r3 = a2[c2];
      h2 ? n2(i2, c2, t3, h2, r3) : e2(i2, c2, t3, r3);
    }
  }
  return r2[t2] = i2;
}
function Kr(t2) {
  return Array.isArray(t2) ? t2[0] instanceof Cr ? t2 : [Dr, t2] : [t2, void 0];
}
function Yr(t2, e2) {
  return t2 instanceof Pr ? t2.v : Array.isArray(t2) ? Ge(t2, e2) : void 0;
}
function qr(t2, e2, n2, r2) {
  const i2 = n2.g;
  t2[e2] = r2 ? (t3, e3, n3) => i2(t3, e3, n3, r2) : i2;
}
function $r(t2, e2, n2, r2, i2) {
  const s2 = n2.g;
  let o2, a2;
  t2[e2] = (t3, e3, n3) => s2(t3, e3, n3, a2 ||= zr(Gr, qr, $r, r2).T, o2 ||= Jr(r2), i2);
}
function Jr(t2) {
  let e2 = t2[jr];
  if (null != e2) return e2;
  const n2 = zr(Gr, qr, $r, t2);
  return e2 = n2.ma ? (t3, e3) => Hr(t3, e3, n2) : (t3, e3) => {
    for (; Jn(e3) && 4 != e3.h; ) {
      var r2 = e3.l, i2 = n2[r2];
      if (null == i2) {
        var s2 = n2.ba;
        s2 && (s2 = s2[r2]) && (null != (s2 = Qr(s2)) && (i2 = n2[r2] = s2));
      }
      if (null == i2 || !i2(e3, t3, r2)) {
        if (i2 = (s2 = e3).m, Zn(s2), s2.ha) var o2 = void 0;
        else o2 = s2.g.g - i2, s2.g.g = i2, o2 = Kn(s2.g, o2);
        i2 = void 0, s2 = t3, o2 && ((i2 = s2[z] ?? (s2[z] = new Fe()))[r2] ?? (i2[r2] = [])).push(o2);
      }
    }
    return (t3 = Re(t3)) && (t3.da = n2.qa[Xr]), true;
  }, t2[jr] = e2, t2[Xr] = Zr.bind(t2), e2;
}
function Zr(t2, e2, n2, r2) {
  var i2 = this[Gr];
  const s2 = this[jr], o2 = Ge(void 0, i2.T), a2 = Re(t2);
  if (a2) {
    var c2 = false, h2 = i2.ba;
    if (h2) {
      if (i2 = (e3, n3, i3) => {
        if (0 !== i3.length) if (h2[n3]) for (const t3 of i3) {
          e3 = qn(t3);
          try {
            c2 = true, s2(o2, e3);
          } finally {
            $n(e3);
          }
        }
        else r2?.(t2, n3, i3);
      }, null == e2) Ie(a2, i2);
      else if (null != a2) {
        const t3 = a2[e2];
        t3 && i2(a2, e2, t3);
      }
      if (c2) {
        let r3 = 0 | t2[et];
        if (2 & r3 && 2048 & r3 && !n2?.Ka) throw Error();
        const i3 = mt(r3), s3 = (e3, s4) => {
          if (null != en(t2, e3, i3)) {
            if (1 === n2?.Qa) return;
            throw Error();
          }
          null != s4 && (r3 = rn(t2, r3, e3, s4, i3)), delete a2[e3];
        };
        null == e2 ? pt(o2, 0 | o2[et], ((t3, e3) => {
          s3(t3, e3);
        })) : s3(e2, en(o2, e2, i3));
      }
    }
  }
}
function Qr(t2) {
  const e2 = (t2 = Kr(t2))[0].g;
  if (t2 = t2[1]) {
    const n2 = Jr(t2), r2 = zr(Gr, qr, $r, t2).T;
    return (t3, i2, s2) => e2(t3, i2, s2, r2, n2);
  }
  return e2;
}
function ti(t2, e2, n2) {
  t2[e2] = n2.h;
}
function ei(t2, e2, n2, r2) {
  let i2, s2;
  const o2 = n2.h;
  t2[e2] = (t3, e3, n3) => o2(t3, e3, n3, s2 ||= zr(Br, ti, ei, r2).T, i2 ||= ni(r2));
}
function ni(t2) {
  let e2 = t2[Vr];
  if (!e2) {
    const n2 = zr(Br, ti, ei, t2);
    e2 = (t3, e3) => ri(t3, e3, n2), t2[Vr] = e2;
  }
  return e2;
}
function ri(t2, e2, n2) {
  pt(t2, 0 | t2[et], ((t3, r2) => {
    if (null != r2) {
      var i2 = (function(t4, e3) {
        var n3 = t4[e3];
        if (n3) return n3;
        if ((n3 = t4.ba) && (n3 = n3[e3])) {
          var r3 = (n3 = Kr(n3))[0].h;
          if (n3 = n3[1]) {
            const e4 = ni(n3), i3 = zr(Br, ti, ei, n3).T;
            n3 = t4.ma ? Wr(i3, e4) : (t5, n4, s2) => r3(t5, n4, s2, i3, e4);
          } else n3 = r3;
          return t4[e3] = n3;
        }
      })(n2, t3);
      i2 ? i2(e2, r2, t3) : t3 < 500 || B(q, 3);
    }
  })), (t2 = Re(t2)) && Ie(t2, ((t3, n3, r2) => {
    for (gr(e2, e2.g.end()), t3 = 0; t3 < r2.length; t3++) gr(e2, M(r2[t3]) || new Uint8Array(0));
  }));
}
var ii = Tt(0);
function si(t2, e2) {
  if (Array.isArray(e2)) {
    var n2 = 0 | e2[et];
    if (4 & n2) return e2;
    for (var r2 = 0, i2 = 0; r2 < e2.length; r2++) {
      const n3 = t2(e2[r2]);
      null != n3 && (e2[i2++] = n3);
    }
    return i2 < r2 && (e2.length = i2), (t2 = -1537 & (5 | n2)) !== n2 && st(e2, t2), 2 & t2 && Object.freeze(e2), e2;
  }
}
function oi(t2, e2, n2) {
  return new Cr(t2, e2, n2);
}
function ai(t2, e2, n2) {
  return new Cr(t2, e2, n2);
}
function ci(t2, e2, n2) {
  rn(t2, 0 | t2[et], e2, n2, mt(0 | t2[et]));
}
var hi = Or((function(t2, e2, n2, r2, i2) {
  if (2 !== t2.h) return false;
  if (t2 = Wt(t2 = Qn(t2, Ge([void 0, void 0], r2), i2)), i2 = mt(r2 = 0 | e2[et]), 2 & r2) throw Error();
  let s2 = en(e2, n2, i2);
  if (s2 instanceof be) 0 != (2 & s2.J) ? (s2 = s2.V(), s2.push(t2), rn(e2, r2, n2, s2, i2)) : s2.Ma(t2);
  else if (Array.isArray(s2)) {
    var o2 = 0 | s2[et];
    8192 & o2 || st(s2, o2 |= 8192), 2 & o2 && (s2 = fn(s2), rn(e2, r2, n2, s2, i2)), s2.push(t2);
  } else rn(e2, r2, n2, at([t2]), i2);
  return true;
}), (function(t2, e2, n2, r2, i2) {
  if (e2 instanceof be) e2.forEach(((e3, s2) => {
    Er(t2, n2, Ge([s2, e3], r2), i2);
  }));
  else if (Array.isArray(e2)) {
    for (let s2 = 0; s2 < e2.length; s2++) {
      const o2 = e2[s2];
      Array.isArray(o2) && Er(t2, n2, Ge(o2, r2), i2);
    }
    at(e2);
  }
}));
function ui(t2, e2, n2) {
  null != (e2 = Qt(e2)) && (mr(t2, n2, 5), t2 = t2.g, Ot(e2), pr(t2));
}
function li(t2, e2, n2) {
  if (e2 = (function(t3) {
    if (null == t3) return t3;
    const e3 = typeof t3;
    if ("bigint" === e3) return String(zt(64, t3));
    if (re(t3)) {
      if ("string" === e3) return ce(t3);
      if ("number" === e3) return ae(t3);
    }
  })(e2), null != e2) {
    if ("string" == typeof e2) cr(e2);
    if (null != e2) switch (mr(t2, n2, 0), typeof e2) {
      case "number":
        t2 = t2.g, Ct(e2), lr(t2, Ft, Mt);
        break;
      case "bigint":
        n2 = BigInt.asUintN(64, e2), n2 = new hr(Number(n2 & BigInt(4294967295)), Number(n2 >> BigInt(32))), lr(t2.g, n2.h, n2.g);
        break;
      default:
        n2 = cr(e2), lr(t2.g, n2.h, n2.g);
    }
  }
}
function fi(t2, e2, n2) {
  null != (e2 = ie(e2)) && null != e2 && (mr(t2, n2, 0), dr(t2.g, e2));
}
function di(t2, e2, n2) {
  null != (e2 = ee(e2)) && (mr(t2, n2, 0), t2.g.g.push(e2 ? 1 : 0));
}
function pi(t2, e2, n2) {
  null != (e2 = ge(e2)) && vr(t2, n2, h(e2));
}
function gi(t2, e2, n2, r2, i2) {
  Er(t2, n2, Yr(e2, r2), i2);
}
function mi(t2, e2, n2) {
  null != (e2 = null == e2 || "string" == typeof e2 || e2 instanceof P ? e2 : void 0) && vr(t2, n2, Dn(e2, true).buffer);
}
function yi(t2, e2, n2) {
  return (5 === t2.h || 2 === t2.h) && (e2 = pn(e2, 0 | e2[et], n2), 2 == t2.h ? nr(t2, Xn, e2) : e2.push(Xn(t2.g)), true);
}
var _i = oi((function(t2, e2, n2) {
  return 5 === t2.h && (ci(e2, n2, Xn(t2.g)), true);
}), ui, Rr);
var vi = ai(yi, (function(t2, e2, n2) {
  if (null != (e2 = si(Qt, e2))) for (let o2 = 0; o2 < e2.length; o2++) {
    var r2 = t2, i2 = n2, s2 = e2[o2];
    null != s2 && (mr(r2, i2, 5), r2 = r2.g, Ot(s2), pr(r2));
  }
}), Rr);
var Ei = ai(yi, (function(t2, e2, n2) {
  if (null != (e2 = si(Qt, e2)) && e2.length) {
    mr(t2, n2, 2), fr(t2.g, 4 * e2.length);
    for (let r2 = 0; r2 < e2.length; r2++) n2 = t2.g, Ot(e2[r2]), pr(n2);
  }
}), Rr);
var wi = oi((function(t2, e2, n2) {
  return 5 === t2.h && (ci(e2, n2, 0 === (t2 = Xn(t2.g)) ? void 0 : t2), true);
}), ui, Rr);
var Ti = oi((function(t2, e2, n2) {
  return p ? (0 !== t2.h ? t2 = false : (ci(e2, n2, Bn(t2.g, Bt)), t2 = true), t2) : 0 === t2.h && (ci(e2, n2, Bn(t2.g, Dt)), true);
}), li, xr);
var Ai = oi((function(t2, e2, n2) {
  return p ? (0 !== t2.h ? e2 = false : (ci(e2, n2, (t2 = Bn(t2.g, Bt)) === ii ? void 0 : t2), e2 = true), e2) : 0 === t2.h && (ci(e2, n2, 0 === (t2 = Bn(t2.g, Dt)) ? void 0 : t2), true);
}), li, xr);
var bi = oi((function(t2, e2, n2) {
  return p ? (0 !== t2.h ? t2 = false : (ci(e2, n2, Bn(t2.g, Ut)), t2 = true), t2) : 0 === t2.h && (ci(e2, n2, Bn(t2.g, Nt)), true);
}), (function(t2, e2, n2) {
  if (e2 = (function(t3) {
    if (null == t3) return t3;
    var e3 = typeof t3;
    if ("bigint" === e3) return String(Kt(64, t3));
    if (re(t3)) {
      if ("string" === e3) return e3 = $t(Number(t3)), Yt(e3) && e3 >= 0 ? t3 = String(e3) : (-1 !== (e3 = t3.indexOf(".")) && (t3 = t3.substring(0, e3)), (e3 = "-" !== t3[0] && ((e3 = t3.length) < 20 || 20 === e3 && t3 <= "18446744073709551615")) || (Xt(t3), t3 = Gt(Ft, Mt))), t3;
      if ("number" === e3) return (t3 = $t(t3)) >= 0 && Yt(t3) || (Ct(t3), t3 = Nt(Ft, Mt)), t3;
    }
  })(e2), null != e2) {
    if ("string" == typeof e2) sr(e2);
    if (null != e2) switch (mr(t2, n2, 0), typeof e2) {
      case "number":
        t2 = t2.g, Ct(e2), lr(t2, Ft, Mt);
        break;
      case "bigint":
        n2 = BigInt.asUintN(64, e2), n2 = new or(Number(n2 & BigInt(4294967295)), Number(n2 >> BigInt(32))), lr(t2.g, n2.h, n2.g);
        break;
      default:
        n2 = sr(e2), lr(t2.g, n2.h, n2.g);
    }
  }
}), Lr);
var ki = oi((function(t2, e2, n2) {
  return 0 === t2.h && (ci(e2, n2, jn(t2.g)), true);
}), fi, kr);
var Si = ai((function(t2, e2, n2) {
  return (0 === t2.h || 2 === t2.h) && (e2 = pn(e2, 0 | e2[et], n2), 2 == t2.h ? nr(t2, jn, e2) : e2.push(jn(t2.g)), true);
}), (function(t2, e2, n2) {
  if (null != (e2 = si(ie, e2)) && e2.length) {
    n2 = yr(t2, n2);
    for (let n3 = 0; n3 < e2.length; n3++) dr(t2.g, e2[n3]);
    _r(t2, n2);
  }
}), kr);
var xi = oi((function(t2, e2, n2) {
  return 0 === t2.h && (ci(e2, n2, 0 === (t2 = jn(t2.g)) ? void 0 : t2), true);
}), fi, kr);
var Li = oi((function(t2, e2, n2) {
  return 0 === t2.h && (ci(e2, n2, Gn(t2.g)), true);
}), di, Ar);
var Ri = oi((function(t2, e2, n2) {
  return 0 === t2.h && (ci(e2, n2, false === (t2 = Gn(t2.g)) ? void 0 : t2), true);
}), di, Ar);
var Ii = ai((function(t2, e2, n2) {
  return 2 === t2.h && (t2 = tr(t2), pn(e2, 0 | e2[et], n2).push(t2), true);
}), (function(t2, e2, n2) {
  if (null != (e2 = si(ge, e2))) for (let o2 = 0; o2 < e2.length; o2++) {
    var r2 = t2, i2 = n2, s2 = e2[o2];
    null != s2 && vr(r2, i2, h(s2));
  }
}), br);
var Fi = oi((function(t2, e2, n2) {
  return 2 === t2.h && (ci(e2, n2, "" === (t2 = tr(t2)) ? void 0 : t2), true);
}), pi, br);
var Mi = oi((function(t2, e2, n2) {
  return 2 === t2.h && (ci(e2, n2, tr(t2)), true);
}), pi, br);
var Pi = (function(t2, e2, n2 = Tr) {
  return new Cr(t2, e2, n2);
})((function(t2, e2, n2, r2, i2) {
  return 2 === t2.h && (r2 = Ge(void 0, r2), pn(e2, 0 | e2[et], n2).push(r2), Qn(t2, r2, i2), true);
}), (function(t2, e2, n2, r2, i2) {
  if (Array.isArray(e2)) {
    for (let s2 = 0; s2 < e2.length; s2++) gi(t2, e2[s2], n2, r2, i2);
    1 & (t2 = 0 | e2[et]) || st(e2, 1 | t2);
  }
}));
var Ci = Or((function(t2, e2, n2, r2, i2, s2) {
  if (2 !== t2.h) return false;
  let o2 = 0 | e2[et];
  return yn(e2, o2, s2, n2, mt(o2)), Qn(t2, e2 = vn(e2, r2, n2), i2), true;
}), gi);
var Oi = oi((function(t2, e2, n2) {
  return 2 === t2.h && (ci(e2, n2, er(t2)), true);
}), mi, Ir);
var Ni = ai((function(t2, e2, n2) {
  return (0 === t2.h || 2 === t2.h) && (e2 = pn(e2, 0 | e2[et], n2), 2 == t2.h ? nr(t2, Vn, e2) : e2.push(Vn(t2.g)), true);
}), (function(t2, e2, n2) {
  if (null != (e2 = si(se, e2))) for (let o2 = 0; o2 < e2.length; o2++) {
    var r2 = t2, i2 = n2, s2 = e2[o2];
    null != s2 && (mr(r2, i2, 0), fr(r2.g, s2));
  }
}), Sr);
var Ui = oi((function(t2, e2, n2) {
  return 0 === t2.h && (ci(e2, n2, 0 === (t2 = Vn(t2.g)) ? void 0 : t2), true);
}), (function(t2, e2, n2) {
  null != (e2 = se(e2)) && null != e2 && (mr(t2, n2, 0), fr(t2.g, e2));
}), Sr);
var Di = oi((function(t2, e2, n2) {
  return 0 === t2.h && (ci(e2, n2, jn(t2.g)), true);
}), (function(t2, e2, n2) {
  null != (e2 = ie(e2)) && (e2 = parseInt(e2, 10), mr(t2, n2, 0), dr(t2.g, e2));
}), Fr);
var Bi = class {
  constructor(t2, e2) {
    var n2 = rs;
    this.g = t2, this.h = e2, this.m = wn, this.j = kn, this.defaultValue = void 0, this.l = null != n2.Oa ? gt : void 0;
  }
  register() {
    _(this);
  }
};
function Gi(t2, e2) {
  return new Bi(t2, e2);
}
function ji(t2, e2) {
  return (n2, r2) => {
    {
      const s2 = { ea: true };
      r2 && Object.assign(s2, r2), n2 = qn(n2, void 0, void 0, s2);
      try {
        const r3 = new t2(), s3 = r3.v;
        Jr(e2)(s3, n2);
        var i2 = r3;
      } finally {
        $n(n2);
      }
    }
    return i2;
  };
}
function Vi(t2) {
  return function() {
    const e2 = new class {
      constructor() {
        this.l = [], this.h = 0, this.g = new class {
          constructor() {
            this.g = [];
          }
          length() {
            return this.g.length;
          }
          end() {
            const t3 = this.g;
            return this.g = [], t3;
          }
        }();
      }
    }();
    ri(this.v, e2, zr(Br, ti, ei, t2)), gr(e2, e2.g.end());
    const n2 = new Uint8Array(e2.h), r2 = e2.l, i2 = r2.length;
    let s2 = 0;
    for (let t3 = 0; t3 < i2; t3++) {
      const e3 = r2[t3];
      n2.set(e3, s2), s2 += e3.length;
    }
    return e2.l = [n2], n2;
  };
}
var Xi = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Hi = [0, Fi, oi((function(t2, e2, n2) {
  return 2 === t2.h && (ci(e2, n2, (t2 = er(t2)) === F() ? void 0 : t2), true);
}), (function(t2, e2, n2) {
  if (null != e2) {
    if (e2 instanceof Pr) {
      const r2 = e2.Ra;
      return void (r2 ? (e2 = r2(e2), null != e2 && vr(t2, n2, Dn(e2, true).buffer)) : B(q, 3));
    }
    if (Array.isArray(e2)) return void B(q, 3);
  }
  mi(t2, e2, n2);
}), Ir)];
var Wi;
var zi = globalThis.trustedTypes;
function Ki(t2) {
  var e2;
  return void 0 === Wi && (Wi = (function() {
    let t3 = null;
    if (!zi) return t3;
    try {
      const e3 = (t4) => t4;
      t3 = zi.createPolicy("goog#html", { createHTML: e3, createScript: e3, createScriptURL: e3 });
    } catch (t4) {
    }
    return t3;
  })()), t2 = (e2 = Wi) ? e2.createScriptURL(t2) : t2, new class {
    constructor(t3) {
      this.g = t3;
    }
    toString() {
      return this.g + "";
    }
  }(t2);
}
function Yi(t2, ...e2) {
  if (0 === e2.length) return Ki(t2[0]);
  let n2 = t2[0];
  for (let r2 = 0; r2 < e2.length; r2++) n2 += encodeURIComponent(e2[r2]) + t2[r2 + 1];
  return Ki(n2);
}
var qi = [0, ki, Di, Li, -1, Si, Di, -1, Li];
var $i = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Ji = [0, Li, Mi, Li, Di, -1, ai((function(t2, e2, n2) {
  return (0 === t2.h || 2 === t2.h) && (e2 = pn(e2, 0 | e2[et], n2), 2 == t2.h ? nr(t2, Hn, e2) : e2.push(jn(t2.g)), true);
}), (function(t2, e2, n2) {
  if (null != (e2 = si(ie, e2)) && e2.length) {
    n2 = yr(t2, n2);
    for (let n3 = 0; n3 < e2.length; n3++) dr(t2.g, e2[n3]);
    _r(t2, n2);
  }
}), Fr), Mi, -1, [0, Li, -1], Di, Li, -1];
var Zi = [0, 3, Li, -1, 2, [0, ki], [0, Di, Li], [0, Mi, -1], [0]];
var Qi = [0, Mi, -2];
var ts = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var es = [0];
var ns = [0, ki, Li, 1, Li, -4];
var rs = class extends Pr {
  constructor(t2) {
    super(t2, 2);
  }
};
var is = {};
is[336783863] = [0, Mi, Li, -1, ki, [0, [1, 2, 3, 4, 5, 6, 7, 8, 9], Ci, es, Ci, Ji, Ci, Qi, Ci, ns, Ci, qi, Ci, [0, Mi, -2], Ci, [0, Mi, Di], Ci, Zi, Ci, [0, Di, -1, Li]], [0, Mi], Li, [0, [1, 3], [2, 4], Ci, [0, Si], -1, Ci, [0, Ii], -1, Pi, [0, Mi, -1]], Mi];
var ss = [0, Ai, -1, Ri, -3, Ai, Si, Fi, xi, Ai, -1, Ri, xi, Ri, -2, Fi];
function os(t2, e2) {
  Nn(t2, 3, e2);
}
function as(t2, e2) {
  Nn(t2, 4, e2);
}
var cs = class extends Pr {
  constructor(t2) {
    super(t2, 500);
  }
  o(t2) {
    return kn(this, 0, 7, t2);
  }
};
var hs = [-1, {}];
var us = [0, Mi, 1, hs];
var ls = [0, Mi, Ii, hs];
function fs(t2, e2) {
  Ln(t2, 1, cs, e2);
}
function ds(t2, e2) {
  Nn(t2, 10, e2);
}
function ps(t2, e2) {
  Nn(t2, 15, e2);
}
var gs = class extends Pr {
  constructor(t2) {
    super(t2, 500);
  }
  o(t2) {
    return kn(this, 0, 1001, t2);
  }
};
var ms = [-500, Pi, [-500, Fi, -1, Ii, -3, [-2, is, Li], Pi, Hi, xi, -1, us, ls, Pi, [0, Fi, Ri], Fi, ss, xi, Ii, 987, Ii], 4, Pi, [-500, Mi, -1, [-1, {}], 998, Mi], Pi, [-500, Mi, Ii, -1, [-2, {}, Li], 997, Ii, -1], xi, Pi, [-500, Mi, Ii, hs, 998, Ii], Ii, xi, us, ls, Pi, [0, Fi, -1, hs], Ii, -2, ss, Fi, -1, Ri, [0, Ri, Ui], 978, hs, Pi, Hi];
gs.prototype.g = Vi(ms);
var ys = ji(gs, ms);
var _s = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var vs = class extends Pr {
  constructor(t2) {
    super(t2);
  }
  g() {
    return An(this, _s, 1);
  }
};
var Es = [0, Pi, [0, ki, _i, Mi, -1]];
var ws = ji(vs, Es);
var Ts = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var As = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var bs = class extends Pr {
  constructor(t2) {
    super(t2);
  }
  l() {
    return wn(this, Ts, 2);
  }
  g() {
    return An(this, As, 5);
  }
};
var ks = ji(class extends Pr {
  constructor(t2) {
    super(t2);
  }
}, [0, Ii, Si, Ei, [0, Di, [0, ki, -3], [0, _i, -3], [0, ki, -1, [0, Pi, [0, ki, -2]]], Pi, [0, _i, -1, Mi, _i]], Mi, -1, Ti, Pi, [0, ki, _i], Ii, Ti]);
var Ss = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var xs = ji(class extends Pr {
  constructor(t2) {
    super(t2);
  }
}, [0, Pi, [0, _i, -4]]);
var Ls = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Rs = ji(class extends Pr {
  constructor(t2) {
    super(t2);
  }
}, [0, Pi, [0, _i, -4]]);
var Is = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Fs = [0, ki, -1, Ei, Di];
var Ms = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
Ms.prototype.g = Vi([0, _i, -4, Ti]);
var Ps = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Cs = ji(class extends Pr {
  constructor(t2) {
    super(t2);
  }
}, [0, Pi, [0, 1, ki, Mi, Es], Ti]);
var Os = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Ns = class extends Pr {
  constructor(t2) {
    super(t2);
  }
  na() {
    const t2 = tn(this, 1, void 0, void 0, ln);
    return null == t2 ? F() : t2;
  }
};
var Us = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Ds = [1, 2];
var Bs = ji(class extends Pr {
  constructor(t2) {
    super(t2);
  }
}, [0, Pi, [0, Ds, Ci, [0, Ei], Ci, [0, Oi], ki, Mi], Ti]);
var Gs = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var js = [0, Mi, ki, _i, Ii, -1];
var Vs = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Xs = [0, Li, -1];
var Hs = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Ws = [1, 2, 3, 4, 5, 6];
var zs = class extends Pr {
  constructor(t2) {
    super(t2);
  }
  g() {
    return null != tn(this, 1, void 0, void 0, ln);
  }
  l() {
    return null != ge(tn(this, 2));
  }
};
var Ks = class extends Pr {
  constructor(t2) {
    super(t2);
  }
  g() {
    return ee(tn(this, 2)) ?? false;
  }
};
var Ys = [0, Oi, Mi, [0, ki, Ti, -1], [0, bi, Ti]];
var qs = [0, Ys, Li, [0, Ws, Ci, ns, Ci, Ji, Ci, qi, Ci, es, Ci, Qi, Ci, Zi], Di];
var $s = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Js = [0, qs, _i, -1, ki];
var Zs = Gi(502141897, $s);
is[502141897] = Js;
var Qs = ji(class extends Pr {
  constructor(t2) {
    super(t2);
  }
}, [0, [0, Di, -1, vi, Ni], Fs]);
var to = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var eo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var no = [0, qs, _i, [0, qs], Li];
var ro = Gi(508968150, eo);
is[508968150] = [0, qs, Js, no, _i, [0, [0, Ys]]], is[508968149] = no;
var io = class extends Pr {
  constructor(t2) {
    super(t2);
  }
  l() {
    return wn(this, Gs, 2);
  }
  g() {
    nn(this, 2);
  }
};
var so = [0, qs, js];
is[478825465] = so;
var oo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var ao = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var co = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var ho = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var uo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var lo = [0, qs, [0, qs], so, -1];
var fo = [0, qs, _i, ki];
var po = [0, qs, _i];
var go = [0, qs, fo, po, _i];
var mo = Gi(479097054, uo);
is[479097054] = [0, qs, go, lo], is[463370452] = lo, is[464864288] = fo;
var yo = Gi(462713202, ho);
is[462713202] = go, is[474472470] = po;
var _o = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var vo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Eo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var wo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var To = [0, qs, _i, -1, ki];
var Ao = [0, qs, _i, Li];
wo.prototype.g = Vi([0, qs, po, [0, qs], Js, no, To, Ao]);
var bo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var ko = Gi(456383383, bo);
is[456383383] = [0, qs, js];
var So = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var xo = Gi(476348187, So);
is[476348187] = [0, qs, Xs];
var Lo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Ro = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Io = [0, Di, -1];
var Fo = Gi(458105876, class extends Pr {
  constructor(t2) {
    super(t2);
  }
  g() {
    let t2;
    var e2 = this.v;
    const n2 = 0 | e2[et];
    return t2 = ht(this, n2), e2 = (function(t3, e3, n3, r2) {
      var i2 = Ro;
      !r2 && Ye(t3) && (n3 = 0 | (e3 = t3.v)[et]);
      var s2 = en(e3, 2);
      if (t3 = false, null == s2) {
        if (r2) return Le();
        s2 = [];
      } else if (s2.constructor === be) {
        if (!(2 & s2.J) || r2) return s2;
        s2 = s2.V();
      } else Array.isArray(s2) ? t3 = !!(2 & (0 | s2[et])) : s2 = [];
      if (r2) {
        if (!s2.length) return Le();
        t3 || (t3 = true, ot(s2));
      } else t3 && (t3 = false, at(s2), s2 = fn(s2));
      return !t3 && 32 & n3 && it(s2, 32), n3 = rn(e3, n3, 2, r2 = new be(s2, i2, ye, void 0)), t3 || $e(e3, n3), r2;
    })(this, e2, n2, t2), !t2 && Ro && (e2.ra = true), e2;
  }
});
is[458105876] = [0, Io, hi, [true, Ti, [0, Mi, -1, Ii]], [0, Si, Li, Di]];
var Mo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Po = Gi(458105758, Mo);
is[458105758] = [0, qs, Mi, Io];
var Co = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Oo = [0, wi, -1, Ri];
var No = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Uo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Do = [1, 2];
Uo.prototype.g = Vi([0, Do, Ci, Oo, Ci, [0, Pi, Oo]]);
var Bo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Go = Gi(443442058, Bo);
is[443442058] = [0, qs, Mi, ki, _i, Ii, -1, Li, _i], is[514774813] = To;
var jo = class extends Pr {
  constructor(t2) {
    super(t2);
  }
};
var Vo = Gi(516587230, jo);
function Xo(t2, e2) {
  return e2 = e2 ? e2.clone() : new Gs(), void 0 !== t2.displayNamesLocale ? nn(e2, 1, pe(t2.displayNamesLocale)) : void 0 === t2.displayNamesLocale && nn(e2, 1), void 0 !== t2.maxResults ? Mn(e2, 2, t2.maxResults) : "maxResults" in t2 && nn(e2, 2), void 0 !== t2.scoreThreshold ? Pn(e2, 3, t2.scoreThreshold) : "scoreThreshold" in t2 && nn(e2, 3), void 0 !== t2.categoryAllowlist ? On(e2, 4, t2.categoryAllowlist) : "categoryAllowlist" in t2 && nn(e2, 4), void 0 !== t2.categoryDenylist ? On(e2, 5, t2.categoryDenylist) : "categoryDenylist" in t2 && nn(e2, 5), e2;
}
function Ho(t2) {
  const e2 = Number(t2);
  return Number.isSafeInteger(e2) ? e2 : String(t2);
}
function Wo(t2, e2 = -1, n2 = "") {
  return { categories: t2.map(((t3) => ({ index: Rn(t3, 1) ?? 0 ?? -1, score: Fn(t3, 2) ?? 0, categoryName: ge(tn(t3, 3)) ?? "" ?? "", displayName: ge(tn(t3, 4)) ?? "" ?? "" }))), headIndex: e2, headName: n2 };
}
function zo(t2) {
  const e2 = { classifications: An(t2, Ps, 1).map(((t3) => Wo(wn(t3, vs, 4)?.g() ?? [], Rn(t3, 2) ?? 0, ge(tn(t3, 3)) ?? ""))) };
  return null != (function(t3) {
    return le(g ? tn(t3, 2, void 0, void 0, fe) : tn(t3, 2));
  })(t2) && (e2.timestampMs = Ho(In(t2))), e2;
}
function Ko(t2) {
  var e2 = on(t2, 3, Qt, sn()), n2 = on(t2, 2, ie, sn()), r2 = on(t2, 1, ge, sn()), i2 = on(t2, 9, ge, sn());
  const s2 = { categories: [], keypoints: [] };
  for (let t3 = 0; t3 < e2.length; t3++) s2.categories.push({ score: e2[t3], index: n2[t3] ?? -1, categoryName: r2[t3] ?? "", displayName: i2[t3] ?? "" });
  if ((e2 = wn(t2, bs, 4)?.l()) && (s2.boundingBox = { originX: Rn(e2, 1, Qe) ?? 0, originY: Rn(e2, 2, Qe) ?? 0, width: Rn(e2, 3, Qe) ?? 0, height: Rn(e2, 4, Qe) ?? 0, angle: 0 }), wn(t2, bs, 4)?.g().length) for (const e3 of wn(t2, bs, 4).g()) s2.keypoints.push({ x: tn(e3, 1, void 0, Qe, Qt) ?? 0, y: tn(e3, 2, void 0, Qe, Qt) ?? 0, score: tn(e3, 4, void 0, Qe, Qt) ?? 0, label: ge(tn(e3, 3, void 0, Qe)) ?? "" });
  return s2;
}
function Yo(t2) {
  const e2 = [];
  for (const n2 of An(t2, Ls, 1)) e2.push({ x: Fn(n2, 1) ?? 0, y: Fn(n2, 2) ?? 0, z: Fn(n2, 3) ?? 0, visibility: Fn(n2, 4) ?? 0 });
  return e2;
}
function qo(t2) {
  const e2 = [];
  for (const n2 of An(t2, Ss, 1)) e2.push({ x: Fn(n2, 1) ?? 0, y: Fn(n2, 2) ?? 0, z: Fn(n2, 3) ?? 0, visibility: Fn(n2, 4) ?? 0 });
  return e2;
}
function $o(t2) {
  return Array.from(t2, ((t3) => t3 > 127 ? t3 - 256 : t3));
}
function Jo(t2, e2) {
  if (t2.length !== e2.length) throw Error(`Cannot compute cosine similarity between embeddings of different sizes (${t2.length} vs. ${e2.length}).`);
  let n2 = 0, r2 = 0, i2 = 0;
  for (let s2 = 0; s2 < t2.length; s2++) n2 += t2[s2] * e2[s2], r2 += t2[s2] * t2[s2], i2 += e2[s2] * e2[s2];
  if (r2 <= 0 || i2 <= 0) throw Error("Cannot compute cosine similarity on embedding with 0 norm.");
  return n2 / Math.sqrt(r2 * i2);
}
var Zo;
is[516587230] = [0, qs, To, Ao, _i], is[518928384] = Ao;
var Qo = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
async function ta() {
  if (void 0 === Zo) try {
    await WebAssembly.instantiate(Qo), Zo = true;
  } catch {
    Zo = false;
  }
  return Zo;
}
async function ea(t2, e2 = Yi``) {
  const n2 = await ta() ? "wasm_internal" : "wasm_nosimd_internal";
  return { wasmLoaderPath: `${e2}/${t2}_${n2}.js`, wasmBinaryPath: `${e2}/${t2}_${n2}.wasm` };
}
var na = class {
};
function ra() {
  var t2 = navigator;
  return "undefined" != typeof OffscreenCanvas && (!(function(t3 = navigator) {
    return (t3 = t3.userAgent).includes("Safari") && !t3.includes("Chrome");
  })(t2) || !!((t2 = t2.userAgent.match(/Version\/([\d]+).*Safari/)) && t2.length >= 1 && Number(t2[1]) >= 17));
}
async function ia(t2) {
  if ("function" != typeof importScripts) {
    const e2 = document.createElement("script");
    return e2.src = t2.toString(), e2.crossOrigin = "anonymous", new Promise(((t3, n2) => {
      e2.addEventListener("load", (() => {
        t3();
      }), false), e2.addEventListener("error", ((t4) => {
        n2(t4);
      }), false), document.body.appendChild(e2);
    }));
  }
  try {
    importScripts(t2.toString());
  } catch (e2) {
    if (!(e2 instanceof TypeError)) throw e2;
    await self.import(t2.toString());
  }
}
function sa(t2) {
  return void 0 !== t2.videoWidth ? [t2.videoWidth, t2.videoHeight] : void 0 !== t2.naturalWidth ? [t2.naturalWidth, t2.naturalHeight] : void 0 !== t2.displayWidth ? [t2.displayWidth, t2.displayHeight] : [t2.width, t2.height];
}
function oa(t2, e2, n2) {
  t2.m || console.error("No wasm multistream support detected: ensure dependency inclusion of :gl_graph_runner_internal_multi_input target"), n2(e2 = t2.i.stringToNewUTF8(e2)), t2.i._free(e2);
}
function aa(t2, e2, n2) {
  if (!t2.i.canvas) throw Error("No OpenGL canvas configured.");
  if (n2 ? t2.i._bindTextureToStream(n2) : t2.i._bindTextureToCanvas(), !(n2 = t2.i.canvas.getContext("webgl2") || t2.i.canvas.getContext("webgl"))) throw Error("Failed to obtain WebGL context from the provided canvas. `getContext()` should only be invoked with `webgl` or `webgl2`.");
  t2.i.gpuOriginForWebTexturesIsBottomLeft && n2.pixelStorei(n2.UNPACK_FLIP_Y_WEBGL, true), n2.texImage2D(n2.TEXTURE_2D, 0, n2.RGBA, n2.RGBA, n2.UNSIGNED_BYTE, e2), t2.i.gpuOriginForWebTexturesIsBottomLeft && n2.pixelStorei(n2.UNPACK_FLIP_Y_WEBGL, false);
  const [r2, i2] = sa(e2);
  return !t2.l || r2 === t2.i.canvas.width && i2 === t2.i.canvas.height || (t2.i.canvas.width = r2, t2.i.canvas.height = i2), [r2, i2];
}
function ca(t2, e2, n2) {
  t2.m || console.error("No wasm multistream support detected: ensure dependency inclusion of :gl_graph_runner_internal_multi_input target");
  const r2 = new Uint32Array(e2.length);
  for (let n3 = 0; n3 < e2.length; n3++) r2[n3] = t2.i.stringToNewUTF8(e2[n3]);
  e2 = t2.i._malloc(4 * r2.length), t2.i.HEAPU32.set(r2, e2 >> 2), n2(e2);
  for (const e3 of r2) t2.i._free(e3);
  t2.i._free(e2);
}
function ha(t2, e2, n2) {
  t2.i.simpleListeners = t2.i.simpleListeners || {}, t2.i.simpleListeners[e2] = n2;
}
function ua(t2, e2, n2) {
  let r2 = [];
  t2.i.simpleListeners = t2.i.simpleListeners || {}, t2.i.simpleListeners[e2] = (t3, e3, i2) => {
    e3 ? (n2(r2, i2), r2 = []) : r2.push(t3);
  };
}
na.forVisionTasks = function(t2) {
  return ea("vision", t2);
}, na.forTextTasks = function(t2) {
  return ea("text", t2);
}, na.forGenAiExperimentalTasks = function(t2) {
  return ea("genai_experimental", t2);
}, na.forGenAiTasks = function(t2) {
  return ea("genai", t2);
}, na.forAudioTasks = function(t2) {
  return ea("audio", t2);
}, na.isSimdSupported = function() {
  return ta();
};
async function la(t2, e2, n2, r2) {
  return t2 = await (async (t3, e3, n3, r3, i2) => {
    if (e3 && await ia(e3), !self.ModuleFactory) throw Error("ModuleFactory not set.");
    if (n3 && (await ia(n3), !self.ModuleFactory)) throw Error("ModuleFactory not set.");
    return self.Module && i2 && ((e3 = self.Module).locateFile = i2.locateFile, i2.mainScriptUrlOrBlob && (e3.mainScriptUrlOrBlob = i2.mainScriptUrlOrBlob)), i2 = await self.ModuleFactory(self.Module || i2), self.ModuleFactory = self.Module = void 0, new t3(i2, r3);
  })(t2, n2.wasmLoaderPath, n2.assetLoaderPath, e2, { locateFile: (t3) => t3.endsWith(".wasm") ? n2.wasmBinaryPath.toString() : n2.assetBinaryPath && t3.endsWith(".data") ? n2.assetBinaryPath.toString() : t3 }), await t2.o(r2), t2;
}
function fa(t2, e2) {
  const n2 = wn(t2.baseOptions, zs, 1) || new zs();
  "string" == typeof e2 ? (nn(n2, 2, pe(e2)), nn(n2, 1)) : e2 instanceof Uint8Array && (nn(n2, 1, lt(e2, false)), nn(n2, 2)), kn(t2.baseOptions, 0, 1, n2);
}
function da(t2) {
  try {
    const e2 = t2.H.length;
    if (1 === e2) throw Error(t2.H[0].message);
    if (e2 > 1) throw Error("Encountered multiple errors: " + t2.H.map(((t3) => t3.message)).join(", "));
  } finally {
    t2.H = [];
  }
}
function pa(t2, e2) {
  t2.C = Math.max(t2.C, e2);
}
function ga(t2, e2) {
  t2.B = new cs(), Cn(t2.B, 2, "PassThroughCalculator"), os(t2.B, "free_memory"), as(t2.B, "free_memory_unused_out"), ds(e2, "free_memory"), fs(e2, t2.B);
}
function ma(t2, e2) {
  os(t2.B, e2), as(t2.B, e2 + "_unused_out");
}
function ya(t2) {
  t2.g.addBoolToStream(true, "free_memory", t2.C);
}
var _a = class {
  constructor(t2) {
    this.g = t2, this.H = [], this.C = 0, this.g.setAutoRenderToScreen(false);
  }
  l(t2, e2 = true) {
    if (e2) {
      const e3 = t2.baseOptions || {};
      if (t2.baseOptions?.modelAssetBuffer && t2.baseOptions?.modelAssetPath) throw Error("Cannot set both baseOptions.modelAssetPath and baseOptions.modelAssetBuffer");
      if (!(wn(this.baseOptions, zs, 1)?.g() || wn(this.baseOptions, zs, 1)?.l() || t2.baseOptions?.modelAssetBuffer || t2.baseOptions?.modelAssetPath)) throw Error("Either baseOptions.modelAssetPath or baseOptions.modelAssetBuffer must be set");
      if ((function(t3, e4) {
        let n2 = wn(t3.baseOptions, Hs, 3);
        if (!n2) {
          var r2 = n2 = new Hs(), i2 = new ts();
          Sn(r2, 4, Ws, i2);
        }
        "delegate" in e4 && ("GPU" === e4.delegate ? (e4 = n2, r2 = new $i(), Sn(e4, 2, Ws, r2)) : (e4 = n2, r2 = new ts(), Sn(e4, 4, Ws, r2))), kn(t3.baseOptions, 0, 3, n2);
      })(this, e3), e3.modelAssetPath) return fetch(e3.modelAssetPath.toString()).then(((t3) => {
        if (t3.ok) return t3.arrayBuffer();
        throw Error(`Failed to fetch model: ${e3.modelAssetPath} (${t3.status})`);
      })).then(((t3) => {
        try {
          this.g.i.FS_unlink("/model.dat");
        } catch {
        }
        this.g.i.FS_createDataFile("/", "model.dat", new Uint8Array(t3), true, false, false), fa(this, "/model.dat"), this.m(), this.L();
      }));
      if (e3.modelAssetBuffer instanceof Uint8Array) fa(this, e3.modelAssetBuffer);
      else if (e3.modelAssetBuffer) return (async function(t3) {
        const e4 = [];
        for (var n2 = 0; ; ) {
          const { done: r2, value: i2 } = await t3.read();
          if (r2) break;
          e4.push(i2), n2 += i2.length;
        }
        if (0 === e4.length) return new Uint8Array(0);
        if (1 === e4.length) return e4[0];
        t3 = new Uint8Array(n2), n2 = 0;
        for (const r2 of e4) t3.set(r2, n2), n2 += r2.length;
        return t3;
      })(e3.modelAssetBuffer).then(((t3) => {
        fa(this, t3), this.m(), this.L();
      }));
    }
    return this.m(), this.L(), Promise.resolve();
  }
  L() {
  }
  ca() {
    let t2;
    if (this.g.ca(((e2) => {
      t2 = ys(e2);
    })), !t2) throw Error("Failed to retrieve CalculatorGraphConfig");
    return t2;
  }
  setGraph(t2, e2) {
    this.g.attachErrorListener(((t3, e3) => {
      this.H.push(Error(e3));
    })), this.g.Ja(), this.g.setGraph(t2, e2), this.B = void 0, da(this);
  }
  finishProcessing() {
    this.g.finishProcessing(), da(this);
  }
  close() {
    this.B = void 0, this.g.closeGraph();
  }
};
function va(t2, e2) {
  if (!t2) throw Error(`Unable to obtain required WebGL resource: ${e2}`);
  return t2;
}
_a.prototype.close = _a.prototype.close;
var Ea = class {
  constructor(t2, e2, n2, r2) {
    this.g = t2, this.h = e2, this.m = n2, this.l = r2;
  }
  bind() {
    this.g.bindVertexArray(this.h);
  }
  close() {
    this.g.deleteVertexArray(this.h), this.g.deleteBuffer(this.m), this.g.deleteBuffer(this.l);
  }
};
function wa(t2, e2, n2) {
  const r2 = t2.g;
  if (n2 = va(r2.createShader(n2), "Failed to create WebGL shader"), r2.shaderSource(n2, e2), r2.compileShader(n2), !r2.getShaderParameter(n2, r2.COMPILE_STATUS)) throw Error(`Could not compile WebGL shader: ${r2.getShaderInfoLog(n2)}`);
  return r2.attachShader(t2.h, n2), n2;
}
function Ta(t2, e2) {
  const n2 = t2.g, r2 = va(n2.createVertexArray(), "Failed to create vertex array");
  n2.bindVertexArray(r2);
  const i2 = va(n2.createBuffer(), "Failed to create buffer");
  n2.bindBuffer(n2.ARRAY_BUFFER, i2), n2.enableVertexAttribArray(t2.O), n2.vertexAttribPointer(t2.O, 2, n2.FLOAT, false, 0, 0), n2.bufferData(n2.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), n2.STATIC_DRAW);
  const s2 = va(n2.createBuffer(), "Failed to create buffer");
  return n2.bindBuffer(n2.ARRAY_BUFFER, s2), n2.enableVertexAttribArray(t2.L), n2.vertexAttribPointer(t2.L, 2, n2.FLOAT, false, 0, 0), n2.bufferData(n2.ARRAY_BUFFER, new Float32Array(e2 ? [0, 1, 0, 0, 1, 0, 1, 1] : [0, 0, 0, 1, 1, 1, 1, 0]), n2.STATIC_DRAW), n2.bindBuffer(n2.ARRAY_BUFFER, null), n2.bindVertexArray(null), new Ea(n2, r2, i2, s2);
}
function Aa(t2, e2) {
  if (t2.g) {
    if (e2 !== t2.g) throw Error("Cannot change GL context once initialized");
  } else t2.g = e2;
}
function ba(t2, e2, n2, r2) {
  return Aa(t2, e2), t2.h || (t2.m(), t2.D()), n2 ? (t2.u || (t2.u = Ta(t2, true)), n2 = t2.u) : (t2.A || (t2.A = Ta(t2, false)), n2 = t2.A), e2.useProgram(t2.h), n2.bind(), t2.l(), t2 = r2(), n2.g.bindVertexArray(null), t2;
}
function ka(t2, e2, n2) {
  return Aa(t2, e2), t2 = va(e2.createTexture(), "Failed to create texture"), e2.bindTexture(e2.TEXTURE_2D, t2), e2.texParameteri(e2.TEXTURE_2D, e2.TEXTURE_WRAP_S, e2.CLAMP_TO_EDGE), e2.texParameteri(e2.TEXTURE_2D, e2.TEXTURE_WRAP_T, e2.CLAMP_TO_EDGE), e2.texParameteri(e2.TEXTURE_2D, e2.TEXTURE_MIN_FILTER, n2 ?? e2.LINEAR), e2.texParameteri(e2.TEXTURE_2D, e2.TEXTURE_MAG_FILTER, n2 ?? e2.LINEAR), e2.bindTexture(e2.TEXTURE_2D, null), t2;
}
function Sa(t2, e2, n2) {
  Aa(t2, e2), t2.B || (t2.B = va(e2.createFramebuffer(), "Failed to create framebuffe.")), e2.bindFramebuffer(e2.FRAMEBUFFER, t2.B), e2.framebufferTexture2D(e2.FRAMEBUFFER, e2.COLOR_ATTACHMENT0, e2.TEXTURE_2D, n2, 0);
}
function xa(t2) {
  t2.g?.bindFramebuffer(t2.g.FRAMEBUFFER, null);
}
var La = class {
  H() {
    return "\n  precision mediump float;\n  varying vec2 vTex;\n  uniform sampler2D inputTexture;\n  void main() {\n    gl_FragColor = texture2D(inputTexture, vTex);\n  }\n ";
  }
  m() {
    const t2 = this.g;
    if (this.h = va(t2.createProgram(), "Failed to create WebGL program"), this.X = wa(this, "\n  attribute vec2 aVertex;\n  attribute vec2 aTex;\n  varying vec2 vTex;\n  void main(void) {\n    gl_Position = vec4(aVertex, 0.0, 1.0);\n    vTex = aTex;\n  }", t2.VERTEX_SHADER), this.W = wa(this, this.H(), t2.FRAGMENT_SHADER), t2.linkProgram(this.h), !t2.getProgramParameter(this.h, t2.LINK_STATUS)) throw Error(`Error during program linking: ${t2.getProgramInfoLog(this.h)}`);
    this.O = t2.getAttribLocation(this.h, "aVertex"), this.L = t2.getAttribLocation(this.h, "aTex");
  }
  D() {
  }
  l() {
  }
  close() {
    if (this.h) {
      const t2 = this.g;
      t2.deleteProgram(this.h), t2.deleteShader(this.X), t2.deleteShader(this.W);
    }
    this.B && this.g.deleteFramebuffer(this.B), this.A && this.A.close(), this.u && this.u.close();
  }
};
var Ra = class extends La {
  H() {
    return "\n  precision mediump float;\n  uniform sampler2D backgroundTexture;\n  uniform sampler2D maskTexture;\n  uniform sampler2D colorMappingTexture;\n  varying vec2 vTex;\n  void main() {\n    vec4 backgroundColor = texture2D(backgroundTexture, vTex);\n    float category = texture2D(maskTexture, vTex).r;\n    vec4 categoryColor = texture2D(colorMappingTexture, vec2(category, 0.0));\n    gl_FragColor = mix(backgroundColor, categoryColor, categoryColor.a);\n  }\n ";
  }
  D() {
    const t2 = this.g;
    t2.activeTexture(t2.TEXTURE1), this.C = ka(this, t2, t2.LINEAR), t2.activeTexture(t2.TEXTURE2), this.j = ka(this, t2, t2.NEAREST);
  }
  m() {
    super.m();
    const t2 = this.g;
    this.P = va(t2.getUniformLocation(this.h, "backgroundTexture"), "Uniform location"), this.U = va(t2.getUniformLocation(this.h, "colorMappingTexture"), "Uniform location"), this.M = va(t2.getUniformLocation(this.h, "maskTexture"), "Uniform location");
  }
  l() {
    super.l();
    const t2 = this.g;
    t2.uniform1i(this.M, 0), t2.uniform1i(this.P, 1), t2.uniform1i(this.U, 2);
  }
  close() {
    this.C && this.g.deleteTexture(this.C), this.j && this.g.deleteTexture(this.j), super.close();
  }
};
var Ia = class extends La {
  H() {
    return "\n  precision mediump float;\n  uniform sampler2D maskTexture;\n  uniform sampler2D defaultTexture;\n  uniform sampler2D overlayTexture;\n  varying vec2 vTex;\n  void main() {\n    float confidence = texture2D(maskTexture, vTex).r;\n    vec4 defaultColor = texture2D(defaultTexture, vTex);\n    vec4 overlayColor = texture2D(overlayTexture, vTex);\n    // Apply the alpha from the overlay and merge in the default color\n    overlayColor = mix(defaultColor, overlayColor, overlayColor.a);\n    gl_FragColor = mix(defaultColor, overlayColor, confidence);\n  }\n ";
  }
  D() {
    const t2 = this.g;
    t2.activeTexture(t2.TEXTURE1), this.j = ka(this, t2), t2.activeTexture(t2.TEXTURE2), this.C = ka(this, t2);
  }
  m() {
    super.m();
    const t2 = this.g;
    this.M = va(t2.getUniformLocation(this.h, "defaultTexture"), "Uniform location"), this.P = va(t2.getUniformLocation(this.h, "overlayTexture"), "Uniform location"), this.I = va(t2.getUniformLocation(this.h, "maskTexture"), "Uniform location");
  }
  l() {
    super.l();
    const t2 = this.g;
    t2.uniform1i(this.I, 0), t2.uniform1i(this.M, 1), t2.uniform1i(this.P, 2);
  }
  close() {
    this.j && this.g.deleteTexture(this.j), this.C && this.g.deleteTexture(this.C), super.close();
  }
};
function Fa(t2, e2) {
  switch (e2) {
    case 0:
      return t2.g.find(((t3) => t3 instanceof Uint8Array));
    case 1:
      return t2.g.find(((t3) => t3 instanceof Float32Array));
    case 2:
      return t2.g.find(((t3) => "undefined" != typeof WebGLTexture && t3 instanceof WebGLTexture));
    default:
      throw Error(`Type is not supported: ${e2}`);
  }
}
function Ma(t2) {
  var e2 = Fa(t2, 1);
  if (!e2) {
    if (e2 = Fa(t2, 0)) e2 = new Float32Array(e2).map(((t3) => t3 / 255));
    else {
      e2 = new Float32Array(t2.width * t2.height);
      const r2 = Ca(t2);
      var n2 = Na(t2);
      if (Sa(n2, r2, Pa(t2)), "iPad Simulator;iPhone Simulator;iPod Simulator;iPad;iPhone;iPod".split(";").includes(navigator.platform) || navigator.userAgent.includes("Mac") && "document" in self && "ontouchend" in self.document) {
        n2 = new Float32Array(t2.width * t2.height * 4), r2.readPixels(0, 0, t2.width, t2.height, r2.RGBA, r2.FLOAT, n2);
        for (let t3 = 0, r3 = 0; t3 < e2.length; ++t3, r3 += 4) e2[t3] = n2[r3];
      } else r2.readPixels(0, 0, t2.width, t2.height, r2.RED, r2.FLOAT, e2);
    }
    t2.g.push(e2);
  }
  return e2;
}
function Pa(t2) {
  let e2 = Fa(t2, 2);
  if (!e2) {
    const n2 = Ca(t2);
    e2 = Ua(t2);
    const r2 = Ma(t2), i2 = Oa(t2);
    n2.texImage2D(n2.TEXTURE_2D, 0, i2, t2.width, t2.height, 0, n2.RED, n2.FLOAT, r2), Da(t2);
  }
  return e2;
}
function Ca(t2) {
  if (!t2.canvas) throw Error("Conversion to different image formats require that a canvas is passed when initializing the image.");
  return t2.h || (t2.h = va(t2.canvas.getContext("webgl2"), "You cannot use a canvas that is already bound to a different type of rendering context.")), t2.h;
}
function Oa(t2) {
  if (t2 = Ca(t2), !Ba) if (t2.getExtension("EXT_color_buffer_float") && t2.getExtension("OES_texture_float_linear") && t2.getExtension("EXT_float_blend")) Ba = t2.R32F;
  else {
    if (!t2.getExtension("EXT_color_buffer_half_float")) throw Error("GPU does not fully support 4-channel float32 or float16 formats");
    Ba = t2.R16F;
  }
  return Ba;
}
function Na(t2) {
  return t2.l || (t2.l = new La()), t2.l;
}
function Ua(t2) {
  const e2 = Ca(t2);
  e2.viewport(0, 0, t2.width, t2.height), e2.activeTexture(e2.TEXTURE0);
  let n2 = Fa(t2, 2);
  return n2 || (n2 = ka(Na(t2), e2, t2.m ? e2.LINEAR : e2.NEAREST), t2.g.push(n2), t2.j = true), e2.bindTexture(e2.TEXTURE_2D, n2), n2;
}
function Da(t2) {
  t2.h.bindTexture(t2.h.TEXTURE_2D, null);
}
var Ba;
var Ga = class {
  constructor(t2, e2, n2, r2, i2, s2, o2) {
    this.g = t2, this.m = e2, this.j = n2, this.canvas = r2, this.l = i2, this.width = s2, this.height = o2, this.j && (0 === --ja && console.error("You seem to be creating MPMask instances without invoking .close(). This leaks resources."));
  }
  Fa() {
    return !!Fa(this, 0);
  }
  ka() {
    return !!Fa(this, 1);
  }
  R() {
    return !!Fa(this, 2);
  }
  ja() {
    return (e2 = Fa(t2 = this, 0)) || (e2 = Ma(t2), e2 = new Uint8Array(e2.map(((t3) => Math.round(255 * t3)))), t2.g.push(e2)), e2;
    var t2, e2;
  }
  ia() {
    return Ma(this);
  }
  N() {
    return Pa(this);
  }
  clone() {
    const t2 = [];
    for (const e2 of this.g) {
      let n2;
      if (e2 instanceof Uint8Array) n2 = new Uint8Array(e2);
      else if (e2 instanceof Float32Array) n2 = new Float32Array(e2);
      else {
        if (!(e2 instanceof WebGLTexture)) throw Error(`Type is not supported: ${e2}`);
        {
          const t3 = Ca(this), e3 = Na(this);
          t3.activeTexture(t3.TEXTURE1), n2 = ka(e3, t3, this.m ? t3.LINEAR : t3.NEAREST), t3.bindTexture(t3.TEXTURE_2D, n2);
          const r2 = Oa(this);
          t3.texImage2D(t3.TEXTURE_2D, 0, r2, this.width, this.height, 0, t3.RED, t3.FLOAT, null), t3.bindTexture(t3.TEXTURE_2D, null), Sa(e3, t3, n2), ba(e3, t3, false, (() => {
            Ua(this), t3.clearColor(0, 0, 0, 0), t3.clear(t3.COLOR_BUFFER_BIT), t3.drawArrays(t3.TRIANGLE_FAN, 0, 4), Da(this);
          })), xa(e3), Da(this);
        }
      }
      t2.push(n2);
    }
    return new Ga(t2, this.m, this.R(), this.canvas, this.l, this.width, this.height);
  }
  close() {
    this.j && Ca(this).deleteTexture(Fa(this, 2)), ja = -1;
  }
};
Ga.prototype.close = Ga.prototype.close, Ga.prototype.clone = Ga.prototype.clone, Ga.prototype.getAsWebGLTexture = Ga.prototype.N, Ga.prototype.getAsFloat32Array = Ga.prototype.ia, Ga.prototype.getAsUint8Array = Ga.prototype.ja, Ga.prototype.hasWebGLTexture = Ga.prototype.R, Ga.prototype.hasFloat32Array = Ga.prototype.ka, Ga.prototype.hasUint8Array = Ga.prototype.Fa;
var ja = 250;
var Va = { color: "white", lineWidth: 4, radius: 6 };
function Xa(t2) {
  return { ...Va, fillColor: (t2 = t2 || {}).color, ...t2 };
}
function Ha(t2, e2) {
  return t2 instanceof Function ? t2(e2) : t2;
}
function Wa(t2, e2, n2) {
  return Math.max(Math.min(e2, n2), Math.min(Math.max(e2, n2), t2));
}
function za(t2) {
  if (!t2.l) throw Error("CPU rendering requested but CanvasRenderingContext2D not provided.");
  return t2.l;
}
function Ka(t2) {
  if (!t2.j) throw Error("GPU rendering requested but WebGL2RenderingContext not provided.");
  return t2.j;
}
function Ya(t2, e2, n2) {
  if (e2.R()) n2(e2.N());
  else {
    const r2 = e2.ka() ? e2.ia() : e2.ja();
    t2.m = t2.m ?? new La();
    const i2 = Ka(t2);
    n2((t2 = new Ga([r2], e2.m, false, i2.canvas, t2.m, e2.width, e2.height)).N()), t2.close();
  }
}
function qa(t2, e2, n2, r2) {
  const i2 = (function(t3) {
    return t3.g || (t3.g = new Ra()), t3.g;
  })(t2), s2 = Ka(t2), o2 = Array.isArray(n2) ? new ImageData(new Uint8ClampedArray(n2), 1, 1) : n2;
  ba(i2, s2, true, (() => {
    !(function(t4, e3, n3, r3) {
      const i3 = t4.g;
      if (i3.activeTexture(i3.TEXTURE0), i3.bindTexture(i3.TEXTURE_2D, e3), i3.activeTexture(i3.TEXTURE1), i3.bindTexture(i3.TEXTURE_2D, t4.C), i3.texImage2D(i3.TEXTURE_2D, 0, i3.RGBA, i3.RGBA, i3.UNSIGNED_BYTE, n3), t4.I && (function(t5, e4) {
        if (t5 !== e4) return false;
        t5 = t5.entries(), e4 = e4.entries();
        for (const [r4, i4] of t5) {
          t5 = r4;
          const s3 = i4;
          var n4 = e4.next();
          if (n4.done) return false;
          const [o3, a2] = n4.value;
          if (n4 = a2, t5 !== o3 || s3[0] !== n4[0] || s3[1] !== n4[1] || s3[2] !== n4[2] || s3[3] !== n4[3]) return false;
        }
        return !!e4.next().done;
      })(t4.I, r3)) i3.activeTexture(i3.TEXTURE2), i3.bindTexture(i3.TEXTURE_2D, t4.j);
      else {
        t4.I = r3;
        const e4 = Array(1024).fill(0);
        r3.forEach(((t5, n4) => {
          if (4 !== t5.length) throw Error(`Color at index ${n4} is not a four-channel value.`);
          e4[4 * n4] = t5[0], e4[4 * n4 + 1] = t5[1], e4[4 * n4 + 2] = t5[2], e4[4 * n4 + 3] = t5[3];
        })), i3.activeTexture(i3.TEXTURE2), i3.bindTexture(i3.TEXTURE_2D, t4.j), i3.texImage2D(i3.TEXTURE_2D, 0, i3.RGBA, 256, 1, 0, i3.RGBA, i3.UNSIGNED_BYTE, new Uint8Array(e4));
      }
    })(i2, e2, o2, r2), s2.clearColor(0, 0, 0, 0), s2.clear(s2.COLOR_BUFFER_BIT), s2.drawArrays(s2.TRIANGLE_FAN, 0, 4);
    const t3 = i2.g;
    t3.activeTexture(t3.TEXTURE0), t3.bindTexture(t3.TEXTURE_2D, null), t3.activeTexture(t3.TEXTURE1), t3.bindTexture(t3.TEXTURE_2D, null), t3.activeTexture(t3.TEXTURE2), t3.bindTexture(t3.TEXTURE_2D, null);
  }));
}
function $a(t2, e2, n2, r2) {
  const i2 = Ka(t2), s2 = (function(t3) {
    return t3.h || (t3.h = new Ia()), t3.h;
  })(t2), o2 = Array.isArray(n2) ? new ImageData(new Uint8ClampedArray(n2), 1, 1) : n2, a2 = Array.isArray(r2) ? new ImageData(new Uint8ClampedArray(r2), 1, 1) : r2;
  ba(s2, i2, true, (() => {
    var t3 = s2.g;
    t3.activeTexture(t3.TEXTURE0), t3.bindTexture(t3.TEXTURE_2D, e2), t3.activeTexture(t3.TEXTURE1), t3.bindTexture(t3.TEXTURE_2D, s2.j), t3.texImage2D(t3.TEXTURE_2D, 0, t3.RGBA, t3.RGBA, t3.UNSIGNED_BYTE, o2), t3.activeTexture(t3.TEXTURE2), t3.bindTexture(t3.TEXTURE_2D, s2.C), t3.texImage2D(t3.TEXTURE_2D, 0, t3.RGBA, t3.RGBA, t3.UNSIGNED_BYTE, a2), i2.clearColor(0, 0, 0, 0), i2.clear(i2.COLOR_BUFFER_BIT), i2.drawArrays(i2.TRIANGLE_FAN, 0, 4), i2.bindTexture(i2.TEXTURE_2D, null), (t3 = s2.g).activeTexture(t3.TEXTURE0), t3.bindTexture(t3.TEXTURE_2D, null), t3.activeTexture(t3.TEXTURE1), t3.bindTexture(t3.TEXTURE_2D, null), t3.activeTexture(t3.TEXTURE2), t3.bindTexture(t3.TEXTURE_2D, null);
  }));
}
var Ja = class {
  constructor(t2, e2) {
    "undefined" != typeof CanvasRenderingContext2D && t2 instanceof CanvasRenderingContext2D || t2 instanceof OffscreenCanvasRenderingContext2D ? (this.l = t2, this.j = e2) : this.j = t2;
  }
  ya(t2, e2) {
    if (t2) {
      var n2 = za(this);
      e2 = Xa(e2), n2.save();
      var r2 = n2.canvas, i2 = 0;
      for (const s2 of t2) n2.fillStyle = Ha(e2.fillColor, { index: i2, from: s2 }), n2.strokeStyle = Ha(e2.color, { index: i2, from: s2 }), n2.lineWidth = Ha(e2.lineWidth, { index: i2, from: s2 }), (t2 = new Path2D()).arc(s2.x * r2.width, s2.y * r2.height, Ha(e2.radius, { index: i2, from: s2 }), 0, 2 * Math.PI), n2.fill(t2), n2.stroke(t2), ++i2;
      n2.restore();
    }
  }
  xa(t2, e2, n2) {
    if (t2 && e2) {
      var r2 = za(this);
      n2 = Xa(n2), r2.save();
      var i2 = r2.canvas, s2 = 0;
      for (const o2 of e2) {
        r2.beginPath(), e2 = t2[o2.start];
        const a2 = t2[o2.end];
        e2 && a2 && (r2.strokeStyle = Ha(n2.color, { index: s2, from: e2, to: a2 }), r2.lineWidth = Ha(n2.lineWidth, { index: s2, from: e2, to: a2 }), r2.moveTo(e2.x * i2.width, e2.y * i2.height), r2.lineTo(a2.x * i2.width, a2.y * i2.height)), ++s2, r2.stroke();
      }
      r2.restore();
    }
  }
  ua(t2, e2) {
    const n2 = za(this);
    e2 = Xa(e2), n2.save(), n2.beginPath(), n2.lineWidth = Ha(e2.lineWidth, {}), n2.strokeStyle = Ha(e2.color, {}), n2.fillStyle = Ha(e2.fillColor, {}), n2.moveTo(t2.originX, t2.originY), n2.lineTo(t2.originX + t2.width, t2.originY), n2.lineTo(t2.originX + t2.width, t2.originY + t2.height), n2.lineTo(t2.originX, t2.originY + t2.height), n2.lineTo(t2.originX, t2.originY), n2.stroke(), n2.fill(), n2.restore();
  }
  va(t2, e2, n2 = [0, 0, 0, 255]) {
    this.l ? (function(t3, e3, n3, r2) {
      const i2 = Ka(t3);
      Ya(t3, e3, ((e4) => {
        qa(t3, e4, n3, r2), (e4 = za(t3)).drawImage(i2.canvas, 0, 0, e4.canvas.width, e4.canvas.height);
      }));
    })(this, t2, n2, e2) : qa(this, t2.N(), n2, e2);
  }
  wa(t2, e2, n2) {
    this.l ? (function(t3, e3, n3, r2) {
      const i2 = Ka(t3);
      Ya(t3, e3, ((e4) => {
        $a(t3, e4, n3, r2), (e4 = za(t3)).drawImage(i2.canvas, 0, 0, e4.canvas.width, e4.canvas.height);
      }));
    })(this, t2, e2, n2) : $a(this, t2.N(), e2, n2);
  }
  close() {
    this.g?.close(), this.g = void 0, this.h?.close(), this.h = void 0, this.m?.close(), this.m = void 0;
  }
};
function Za(t2, e2) {
  switch (e2) {
    case 0:
      return t2.g.find(((t3) => t3 instanceof ImageData));
    case 1:
      return t2.g.find(((t3) => "undefined" != typeof ImageBitmap && t3 instanceof ImageBitmap));
    case 2:
      return t2.g.find(((t3) => "undefined" != typeof WebGLTexture && t3 instanceof WebGLTexture));
    default:
      throw Error(`Type is not supported: ${e2}`);
  }
}
function Qa(t2) {
  var e2 = Za(t2, 0);
  if (!e2) {
    e2 = ec(t2);
    const n2 = nc(t2), r2 = new Uint8Array(t2.width * t2.height * 4);
    Sa(n2, e2, tc(t2)), e2.readPixels(0, 0, t2.width, t2.height, e2.RGBA, e2.UNSIGNED_BYTE, r2), xa(n2), e2 = new ImageData(new Uint8ClampedArray(r2.buffer), t2.width, t2.height), t2.g.push(e2);
  }
  return e2;
}
function tc(t2) {
  let e2 = Za(t2, 2);
  if (!e2) {
    const n2 = ec(t2);
    e2 = rc(t2);
    const r2 = Za(t2, 1) || Qa(t2);
    n2.texImage2D(n2.TEXTURE_2D, 0, n2.RGBA, n2.RGBA, n2.UNSIGNED_BYTE, r2), ic(t2);
  }
  return e2;
}
function ec(t2) {
  if (!t2.canvas) throw Error("Conversion to different image formats require that a canvas is passed when initializing the image.");
  return t2.h || (t2.h = va(t2.canvas.getContext("webgl2"), "You cannot use a canvas that is already bound to a different type of rendering context.")), t2.h;
}
function nc(t2) {
  return t2.l || (t2.l = new La()), t2.l;
}
function rc(t2) {
  const e2 = ec(t2);
  e2.viewport(0, 0, t2.width, t2.height), e2.activeTexture(e2.TEXTURE0);
  let n2 = Za(t2, 2);
  return n2 || (n2 = ka(nc(t2), e2), t2.g.push(n2), t2.m = true), e2.bindTexture(e2.TEXTURE_2D, n2), n2;
}
function ic(t2) {
  t2.h.bindTexture(t2.h.TEXTURE_2D, null);
}
function sc(t2) {
  const e2 = ec(t2);
  return ba(nc(t2), e2, true, (() => (function(t3, e3) {
    const n2 = t3.canvas;
    if (n2.width === t3.width && n2.height === t3.height) return e3();
    const r2 = n2.width, i2 = n2.height;
    return n2.width = t3.width, n2.height = t3.height, t3 = e3(), n2.width = r2, n2.height = i2, t3;
  })(t2, (() => {
    if (e2.bindFramebuffer(e2.FRAMEBUFFER, null), e2.clearColor(0, 0, 0, 0), e2.clear(e2.COLOR_BUFFER_BIT), e2.drawArrays(e2.TRIANGLE_FAN, 0, 4), !(t2.canvas instanceof OffscreenCanvas)) throw Error("Conversion to ImageBitmap requires that the MediaPipe Tasks is initialized with an OffscreenCanvas");
    return t2.canvas.transferToImageBitmap();
  }))));
}
Ja.prototype.close = Ja.prototype.close, Ja.prototype.drawConfidenceMask = Ja.prototype.wa, Ja.prototype.drawCategoryMask = Ja.prototype.va, Ja.prototype.drawBoundingBox = Ja.prototype.ua, Ja.prototype.drawConnectors = Ja.prototype.xa, Ja.prototype.drawLandmarks = Ja.prototype.ya, Ja.lerp = function(t2, e2, n2, r2, i2) {
  return Wa(r2 * (1 - (t2 - e2) / (n2 - e2)) + i2 * (1 - (n2 - t2) / (n2 - e2)), r2, i2);
}, Ja.clamp = Wa;
var oc = class {
  constructor(t2, e2, n2, r2, i2, s2, o2) {
    this.g = t2, this.j = e2, this.m = n2, this.canvas = r2, this.l = i2, this.width = s2, this.height = o2, (this.j || this.m) && (0 === --ac && console.error("You seem to be creating MPImage instances without invoking .close(). This leaks resources."));
  }
  Ea() {
    return !!Za(this, 0);
  }
  la() {
    return !!Za(this, 1);
  }
  R() {
    return !!Za(this, 2);
  }
  Ca() {
    return Qa(this);
  }
  Ba() {
    var t2 = Za(this, 1);
    return t2 || (tc(this), rc(this), t2 = sc(this), ic(this), this.g.push(t2), this.j = true), t2;
  }
  N() {
    return tc(this);
  }
  clone() {
    const t2 = [];
    for (const e2 of this.g) {
      let n2;
      if (e2 instanceof ImageData) n2 = new ImageData(e2.data, this.width, this.height);
      else if (e2 instanceof WebGLTexture) {
        const t3 = ec(this), e3 = nc(this);
        t3.activeTexture(t3.TEXTURE1), n2 = ka(e3, t3), t3.bindTexture(t3.TEXTURE_2D, n2), t3.texImage2D(t3.TEXTURE_2D, 0, t3.RGBA, this.width, this.height, 0, t3.RGBA, t3.UNSIGNED_BYTE, null), t3.bindTexture(t3.TEXTURE_2D, null), Sa(e3, t3, n2), ba(e3, t3, false, (() => {
          rc(this), t3.clearColor(0, 0, 0, 0), t3.clear(t3.COLOR_BUFFER_BIT), t3.drawArrays(t3.TRIANGLE_FAN, 0, 4), ic(this);
        })), xa(e3), ic(this);
      } else {
        if (!(e2 instanceof ImageBitmap)) throw Error(`Type is not supported: ${e2}`);
        tc(this), rc(this), n2 = sc(this), ic(this);
      }
      t2.push(n2);
    }
    return new oc(t2, this.la(), this.R(), this.canvas, this.l, this.width, this.height);
  }
  close() {
    this.j && Za(this, 1).close(), this.m && ec(this).deleteTexture(Za(this, 2)), ac = -1;
  }
};
oc.prototype.close = oc.prototype.close, oc.prototype.clone = oc.prototype.clone, oc.prototype.getAsWebGLTexture = oc.prototype.N, oc.prototype.getAsImageBitmap = oc.prototype.Ba, oc.prototype.getAsImageData = oc.prototype.Ca, oc.prototype.hasWebGLTexture = oc.prototype.R, oc.prototype.hasImageBitmap = oc.prototype.la, oc.prototype.hasImageData = oc.prototype.Ea;
var ac = 250;
function cc(...t2) {
  return t2.map((([t3, e2]) => ({ start: t3, end: e2 })));
}
var hc = /* @__PURE__ */ (function(t2) {
  return class extends t2 {
    Ja() {
      this.i._registerModelResourcesGraphService();
    }
  };
})((uc = class {
  constructor(t2, e2) {
    this.l = true, this.i = t2, this.g = null, this.h = 0, this.m = "function" == typeof this.i._addIntToInputStream, void 0 !== e2 ? this.i.canvas = e2 : ra() ? this.i.canvas = new OffscreenCanvas(1, 1) : (console.warn("OffscreenCanvas not supported and GraphRunner constructor glCanvas parameter is undefined. Creating backup canvas."), this.i.canvas = document.createElement("canvas"));
  }
  async initializeGraph(t2) {
    const e2 = await (await fetch(t2)).arrayBuffer();
    t2 = !(t2.endsWith(".pbtxt") || t2.endsWith(".textproto")), this.setGraph(new Uint8Array(e2), t2);
  }
  setGraphFromString(t2) {
    this.setGraph(new TextEncoder().encode(t2), false);
  }
  setGraph(t2, e2) {
    const n2 = t2.length, r2 = this.i._malloc(n2);
    this.i.HEAPU8.set(t2, r2), e2 ? this.i._changeBinaryGraph(n2, r2) : this.i._changeTextGraph(n2, r2), this.i._free(r2);
  }
  configureAudio(t2, e2, n2, r2, i2) {
    this.i._configureAudio || console.warn('Attempting to use configureAudio without support for input audio. Is build dep ":gl_graph_runner_audio" missing?'), oa(this, r2 || "input_audio", ((r3) => {
      oa(this, i2 = i2 || "audio_header", ((i3) => {
        this.i._configureAudio(r3, i3, t2, e2 ?? 0, n2);
      }));
    }));
  }
  setAutoResizeCanvas(t2) {
    this.l = t2;
  }
  setAutoRenderToScreen(t2) {
    this.i._setAutoRenderToScreen(t2);
  }
  setGpuBufferVerticalFlip(t2) {
    this.i.gpuOriginForWebTexturesIsBottomLeft = t2;
  }
  ca(t2) {
    ha(this, "__graph_config__", ((e2) => {
      t2(e2);
    })), oa(this, "__graph_config__", ((t3) => {
      this.i._getGraphConfig(t3, void 0);
    })), delete this.i.simpleListeners.__graph_config__;
  }
  attachErrorListener(t2) {
    this.i.errorListener = t2;
  }
  attachEmptyPacketListener(t2, e2) {
    this.i.emptyPacketListeners = this.i.emptyPacketListeners || {}, this.i.emptyPacketListeners[t2] = e2;
  }
  addAudioToStream(t2, e2, n2) {
    this.addAudioToStreamWithShape(t2, 0, 0, e2, n2);
  }
  addAudioToStreamWithShape(t2, e2, n2, r2, i2) {
    const s2 = 4 * t2.length;
    this.h !== s2 && (this.g && this.i._free(this.g), this.g = this.i._malloc(s2), this.h = s2), this.i.HEAPF32.set(t2, this.g / 4), oa(this, r2, ((t3) => {
      this.i._addAudioToInputStream(this.g, e2, n2, t3, i2);
    }));
  }
  addGpuBufferToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      const [r2, i2] = aa(this, t2, e3);
      this.i._addBoundTextureToStream(e3, r2, i2, n2);
    }));
  }
  addBoolToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      this.i._addBoolToInputStream(t2, e3, n2);
    }));
  }
  addDoubleToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      this.i._addDoubleToInputStream(t2, e3, n2);
    }));
  }
  addFloatToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      this.i._addFloatToInputStream(t2, e3, n2);
    }));
  }
  addIntToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      this.i._addIntToInputStream(t2, e3, n2);
    }));
  }
  addUintToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      this.i._addUintToInputStream(t2, e3, n2);
    }));
  }
  addStringToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      oa(this, t2, ((t3) => {
        this.i._addStringToInputStream(t3, e3, n2);
      }));
    }));
  }
  addStringRecordToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      ca(this, Object.keys(t2), ((r2) => {
        ca(this, Object.values(t2), ((i2) => {
          this.i._addFlatHashMapToInputStream(r2, i2, Object.keys(t2).length, e3, n2);
        }));
      }));
    }));
  }
  addProtoToStream(t2, e2, n2, r2) {
    oa(this, n2, ((n3) => {
      oa(this, e2, ((e3) => {
        const i2 = this.i._malloc(t2.length);
        this.i.HEAPU8.set(t2, i2), this.i._addProtoToInputStream(i2, t2.length, e3, n3, r2), this.i._free(i2);
      }));
    }));
  }
  addEmptyPacketToStream(t2, e2) {
    oa(this, t2, ((t3) => {
      this.i._addEmptyPacketToInputStream(t3, e2);
    }));
  }
  addBoolVectorToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      const r2 = this.i._allocateBoolVector(t2.length);
      if (!r2) throw Error("Unable to allocate new bool vector on heap.");
      for (const e4 of t2) this.i._addBoolVectorEntry(r2, e4);
      this.i._addBoolVectorToInputStream(r2, e3, n2);
    }));
  }
  addDoubleVectorToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      const r2 = this.i._allocateDoubleVector(t2.length);
      if (!r2) throw Error("Unable to allocate new double vector on heap.");
      for (const e4 of t2) this.i._addDoubleVectorEntry(r2, e4);
      this.i._addDoubleVectorToInputStream(r2, e3, n2);
    }));
  }
  addFloatVectorToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      const r2 = this.i._allocateFloatVector(t2.length);
      if (!r2) throw Error("Unable to allocate new float vector on heap.");
      for (const e4 of t2) this.i._addFloatVectorEntry(r2, e4);
      this.i._addFloatVectorToInputStream(r2, e3, n2);
    }));
  }
  addIntVectorToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      const r2 = this.i._allocateIntVector(t2.length);
      if (!r2) throw Error("Unable to allocate new int vector on heap.");
      for (const e4 of t2) this.i._addIntVectorEntry(r2, e4);
      this.i._addIntVectorToInputStream(r2, e3, n2);
    }));
  }
  addUintVectorToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      const r2 = this.i._allocateUintVector(t2.length);
      if (!r2) throw Error("Unable to allocate new unsigned int vector on heap.");
      for (const e4 of t2) this.i._addUintVectorEntry(r2, e4);
      this.i._addUintVectorToInputStream(r2, e3, n2);
    }));
  }
  addStringVectorToStream(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      const r2 = this.i._allocateStringVector(t2.length);
      if (!r2) throw Error("Unable to allocate new string vector on heap.");
      for (const e4 of t2) oa(this, e4, ((t3) => {
        this.i._addStringVectorEntry(r2, t3);
      }));
      this.i._addStringVectorToInputStream(r2, e3, n2);
    }));
  }
  addBoolToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      this.i._addBoolToInputSidePacket(t2, e3);
    }));
  }
  addDoubleToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      this.i._addDoubleToInputSidePacket(t2, e3);
    }));
  }
  addFloatToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      this.i._addFloatToInputSidePacket(t2, e3);
    }));
  }
  addIntToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      this.i._addIntToInputSidePacket(t2, e3);
    }));
  }
  addUintToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      this.i._addUintToInputSidePacket(t2, e3);
    }));
  }
  addStringToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      oa(this, t2, ((t3) => {
        this.i._addStringToInputSidePacket(t3, e3);
      }));
    }));
  }
  addProtoToInputSidePacket(t2, e2, n2) {
    oa(this, n2, ((n3) => {
      oa(this, e2, ((e3) => {
        const r2 = this.i._malloc(t2.length);
        this.i.HEAPU8.set(t2, r2), this.i._addProtoToInputSidePacket(r2, t2.length, e3, n3), this.i._free(r2);
      }));
    }));
  }
  addBoolVectorToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      const n2 = this.i._allocateBoolVector(t2.length);
      if (!n2) throw Error("Unable to allocate new bool vector on heap.");
      for (const e4 of t2) this.i._addBoolVectorEntry(n2, e4);
      this.i._addBoolVectorToInputSidePacket(n2, e3);
    }));
  }
  addDoubleVectorToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      const n2 = this.i._allocateDoubleVector(t2.length);
      if (!n2) throw Error("Unable to allocate new double vector on heap.");
      for (const e4 of t2) this.i._addDoubleVectorEntry(n2, e4);
      this.i._addDoubleVectorToInputSidePacket(n2, e3);
    }));
  }
  addFloatVectorToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      const n2 = this.i._allocateFloatVector(t2.length);
      if (!n2) throw Error("Unable to allocate new float vector on heap.");
      for (const e4 of t2) this.i._addFloatVectorEntry(n2, e4);
      this.i._addFloatVectorToInputSidePacket(n2, e3);
    }));
  }
  addIntVectorToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      const n2 = this.i._allocateIntVector(t2.length);
      if (!n2) throw Error("Unable to allocate new int vector on heap.");
      for (const e4 of t2) this.i._addIntVectorEntry(n2, e4);
      this.i._addIntVectorToInputSidePacket(n2, e3);
    }));
  }
  addUintVectorToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      const n2 = this.i._allocateUintVector(t2.length);
      if (!n2) throw Error("Unable to allocate new unsigned int vector on heap.");
      for (const e4 of t2) this.i._addUintVectorEntry(n2, e4);
      this.i._addUintVectorToInputSidePacket(n2, e3);
    }));
  }
  addStringVectorToInputSidePacket(t2, e2) {
    oa(this, e2, ((e3) => {
      const n2 = this.i._allocateStringVector(t2.length);
      if (!n2) throw Error("Unable to allocate new string vector on heap.");
      for (const e4 of t2) oa(this, e4, ((t3) => {
        this.i._addStringVectorEntry(n2, t3);
      }));
      this.i._addStringVectorToInputSidePacket(n2, e3);
    }));
  }
  attachBoolListener(t2, e2) {
    ha(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachBoolListener(t3);
    }));
  }
  attachBoolVectorListener(t2, e2) {
    ua(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachBoolVectorListener(t3);
    }));
  }
  attachIntListener(t2, e2) {
    ha(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachIntListener(t3);
    }));
  }
  attachIntVectorListener(t2, e2) {
    ua(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachIntVectorListener(t3);
    }));
  }
  attachUintListener(t2, e2) {
    ha(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachUintListener(t3);
    }));
  }
  attachUintVectorListener(t2, e2) {
    ua(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachUintVectorListener(t3);
    }));
  }
  attachDoubleListener(t2, e2) {
    ha(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachDoubleListener(t3);
    }));
  }
  attachDoubleVectorListener(t2, e2) {
    ua(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachDoubleVectorListener(t3);
    }));
  }
  attachFloatListener(t2, e2) {
    ha(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachFloatListener(t3);
    }));
  }
  attachFloatVectorListener(t2, e2) {
    ua(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachFloatVectorListener(t3);
    }));
  }
  attachStringListener(t2, e2) {
    ha(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachStringListener(t3);
    }));
  }
  attachStringVectorListener(t2, e2) {
    ua(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachStringVectorListener(t3);
    }));
  }
  attachProtoListener(t2, e2, n2) {
    ha(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachProtoListener(t3, n2 || false);
    }));
  }
  attachProtoVectorListener(t2, e2, n2) {
    ua(this, t2, e2), oa(this, t2, ((t3) => {
      this.i._attachProtoVectorListener(t3, n2 || false);
    }));
  }
  attachAudioListener(t2, e2, n2) {
    this.i._attachAudioListener || console.warn('Attempting to use attachAudioListener without support for output audio. Is build dep ":gl_graph_runner_audio_out" missing?'), ha(this, t2, ((t3, n3) => {
      t3 = new Float32Array(t3.buffer, t3.byteOffset, t3.length / 4), e2(t3, n3);
    })), oa(this, t2, ((t3) => {
      this.i._attachAudioListener(t3, n2 || false);
    }));
  }
  finishProcessing() {
    this.i._waitUntilIdle();
  }
  closeGraph() {
    this.i._closeGraph(), this.i.simpleListeners = void 0, this.i.emptyPacketListeners = void 0;
  }
}, class extends uc {
  get ga() {
    return this.i;
  }
  pa(t2, e2, n2) {
    oa(this, e2, ((e3) => {
      const [r2, i2] = aa(this, t2, e3);
      this.ga._addBoundTextureAsImageToStream(e3, r2, i2, n2);
    }));
  }
  Z(t2, e2) {
    ha(this, t2, e2), oa(this, t2, ((t3) => {
      this.ga._attachImageListener(t3);
    }));
  }
  aa(t2, e2) {
    ua(this, t2, e2), oa(this, t2, ((t3) => {
      this.ga._attachImageVectorListener(t3);
    }));
  }
}));
var uc;
var lc = class extends hc {
};
async function fc(t2, e2, n2) {
  return (async function(t3, e3, n3, r2) {
    return la(t3, e3, n3, r2);
  })(t2, n2.canvas ?? (ra() ? void 0 : document.createElement("canvas")), e2, n2);
}
function dc(t2, e2, n2, r2) {
  if (t2.U) {
    const s2 = new Ms();
    if (n2?.regionOfInterest) {
      if (!t2.oa) throw Error("This task doesn't support region-of-interest.");
      var i2 = n2.regionOfInterest;
      if (i2.left >= i2.right || i2.top >= i2.bottom) throw Error("Expected RectF with left < right and top < bottom.");
      if (i2.left < 0 || i2.top < 0 || i2.right > 1 || i2.bottom > 1) throw Error("Expected RectF values to be in [0,1].");
      Pn(s2, 1, (i2.left + i2.right) / 2), Pn(s2, 2, (i2.top + i2.bottom) / 2), Pn(s2, 4, i2.right - i2.left), Pn(s2, 3, i2.bottom - i2.top);
    } else Pn(s2, 1, 0.5), Pn(s2, 2, 0.5), Pn(s2, 4, 1), Pn(s2, 3, 1);
    if (n2?.rotationDegrees) {
      if (n2?.rotationDegrees % 90 != 0) throw Error("Expected rotation to be a multiple of 90°.");
      if (Pn(s2, 5, -Math.PI * n2.rotationDegrees / 180), n2?.rotationDegrees % 180 != 0) {
        const [t3, r3] = sa(e2);
        n2 = Fn(s2, 3) * r3 / t3, i2 = Fn(s2, 4) * t3 / r3, Pn(s2, 4, n2), Pn(s2, 3, i2);
      }
    }
    t2.g.addProtoToStream(s2.g(), "mediapipe.NormalizedRect", t2.U, r2);
  }
  t2.g.pa(e2, t2.X, r2 ?? performance.now()), t2.finishProcessing();
}
function pc(t2, e2, n2) {
  if (t2.baseOptions?.g()) throw Error("Task is not initialized with image mode. 'runningMode' must be set to 'IMAGE'.");
  dc(t2, e2, n2, t2.C + 1);
}
function gc(t2, e2, n2, r2) {
  if (!t2.baseOptions?.g()) throw Error("Task is not initialized with video mode. 'runningMode' must be set to 'VIDEO'.");
  dc(t2, e2, n2, r2);
}
function mc(t2, e2, n2, r2) {
  var i2 = e2.data;
  const s2 = e2.width, o2 = s2 * (e2 = e2.height);
  if ((i2 instanceof Uint8Array || i2 instanceof Float32Array) && i2.length !== o2) throw Error("Unsupported channel count: " + i2.length / o2);
  return t2 = new Ga([i2], n2, false, t2.g.i.canvas, t2.P, s2, e2), r2 ? t2.clone() : t2;
}
var yc = class extends _a {
  constructor(t2, e2, n2, r2) {
    super(t2), this.g = t2, this.X = e2, this.U = n2, this.oa = r2, this.P = new La();
  }
  l(t2, e2 = true) {
    if ("runningMode" in t2 && nn(this.baseOptions, 2, te(!!t2.runningMode && "IMAGE" !== t2.runningMode)), void 0 !== t2.canvas && this.g.i.canvas !== t2.canvas) throw Error("You must create a new task to reset the canvas.");
    return super.l(t2, e2);
  }
  close() {
    this.P.close(), super.close();
  }
};
yc.prototype.close = yc.prototype.close;
var _c = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "image_in", "norm_rect_in", false), this.j = { detections: [] }, kn(t2 = this.h = new $s(), 0, 1, e2 = new Ks()), Pn(this.h, 2, 0.5), Pn(this.h, 3, 0.3);
  }
  get baseOptions() {
    return wn(this.h, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.h, 0, 1, t2);
  }
  o(t2) {
    return "minDetectionConfidence" in t2 && Pn(this.h, 2, t2.minDetectionConfidence ?? 0.5), "minSuppressionThreshold" in t2 && Pn(this.h, 3, t2.minSuppressionThreshold ?? 0.3), this.l(t2);
  }
  F(t2, e2) {
    return this.j = { detections: [] }, pc(this, t2, e2), this.j;
  }
  G(t2, e2, n2) {
    return this.j = { detections: [] }, gc(this, t2, n2, e2), this.j;
  }
  m() {
    var t2 = new gs();
    ds(t2, "image_in"), ds(t2, "norm_rect_in"), ps(t2, "detections");
    const e2 = new rs();
    Mr(e2, Zs, this.h);
    const n2 = new cs();
    Cn(n2, 2, "mediapipe.tasks.vision.face_detector.FaceDetectorGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect_in"), as(n2, "DETECTIONS:detections"), n2.o(e2), fs(t2, n2), this.g.attachProtoVectorListener("detections", ((t3, e3) => {
      for (const e4 of t3) t3 = ks(e4), this.j.detections.push(Ko(t3));
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("detections", ((t3) => {
      pa(this, t3);
    })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
_c.prototype.detectForVideo = _c.prototype.G, _c.prototype.detect = _c.prototype.F, _c.prototype.setOptions = _c.prototype.o, _c.createFromModelPath = async function(t2, e2) {
  return fc(_c, t2, { baseOptions: { modelAssetPath: e2 } });
}, _c.createFromModelBuffer = function(t2, e2) {
  return fc(_c, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, _c.createFromOptions = function(t2, e2) {
  return fc(_c, t2, e2);
};
var vc = cc([61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314], [314, 405], [405, 321], [321, 375], [375, 291], [61, 185], [185, 40], [40, 39], [39, 37], [37, 0], [0, 267], [267, 269], [269, 270], [270, 409], [409, 291], [78, 95], [95, 88], [88, 178], [178, 87], [87, 14], [14, 317], [317, 402], [402, 318], [318, 324], [324, 308], [78, 191], [191, 80], [80, 81], [81, 82], [82, 13], [13, 312], [312, 311], [311, 310], [310, 415], [415, 308]);
var Ec = cc([263, 249], [249, 390], [390, 373], [373, 374], [374, 380], [380, 381], [381, 382], [382, 362], [263, 466], [466, 388], [388, 387], [387, 386], [386, 385], [385, 384], [384, 398], [398, 362]);
var wc = cc([276, 283], [283, 282], [282, 295], [295, 285], [300, 293], [293, 334], [334, 296], [296, 336]);
var Tc = cc([474, 475], [475, 476], [476, 477], [477, 474]);
var Ac = cc([33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154], [154, 155], [155, 133], [33, 246], [246, 161], [161, 160], [160, 159], [159, 158], [158, 157], [157, 173], [173, 133]);
var bc = cc([46, 53], [53, 52], [52, 65], [65, 55], [70, 63], [63, 105], [105, 66], [66, 107]);
var kc = cc([469, 470], [470, 471], [471, 472], [472, 469]);
var Sc = cc([10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397], [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152], [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172], [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162], [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10]);
var xc = [...vc, ...Ec, ...wc, ...Ac, ...bc, ...Sc];
var Lc = cc([127, 34], [34, 139], [139, 127], [11, 0], [0, 37], [37, 11], [232, 231], [231, 120], [120, 232], [72, 37], [37, 39], [39, 72], [128, 121], [121, 47], [47, 128], [232, 121], [121, 128], [128, 232], [104, 69], [69, 67], [67, 104], [175, 171], [171, 148], [148, 175], [118, 50], [50, 101], [101, 118], [73, 39], [39, 40], [40, 73], [9, 151], [151, 108], [108, 9], [48, 115], [115, 131], [131, 48], [194, 204], [204, 211], [211, 194], [74, 40], [40, 185], [185, 74], [80, 42], [42, 183], [183, 80], [40, 92], [92, 186], [186, 40], [230, 229], [229, 118], [118, 230], [202, 212], [212, 214], [214, 202], [83, 18], [18, 17], [17, 83], [76, 61], [61, 146], [146, 76], [160, 29], [29, 30], [30, 160], [56, 157], [157, 173], [173, 56], [106, 204], [204, 194], [194, 106], [135, 214], [214, 192], [192, 135], [203, 165], [165, 98], [98, 203], [21, 71], [71, 68], [68, 21], [51, 45], [45, 4], [4, 51], [144, 24], [24, 23], [23, 144], [77, 146], [146, 91], [91, 77], [205, 50], [50, 187], [187, 205], [201, 200], [200, 18], [18, 201], [91, 106], [106, 182], [182, 91], [90, 91], [91, 181], [181, 90], [85, 84], [84, 17], [17, 85], [206, 203], [203, 36], [36, 206], [148, 171], [171, 140], [140, 148], [92, 40], [40, 39], [39, 92], [193, 189], [189, 244], [244, 193], [159, 158], [158, 28], [28, 159], [247, 246], [246, 161], [161, 247], [236, 3], [3, 196], [196, 236], [54, 68], [68, 104], [104, 54], [193, 168], [168, 8], [8, 193], [117, 228], [228, 31], [31, 117], [189, 193], [193, 55], [55, 189], [98, 97], [97, 99], [99, 98], [126, 47], [47, 100], [100, 126], [166, 79], [79, 218], [218, 166], [155, 154], [154, 26], [26, 155], [209, 49], [49, 131], [131, 209], [135, 136], [136, 150], [150, 135], [47, 126], [126, 217], [217, 47], [223, 52], [52, 53], [53, 223], [45, 51], [51, 134], [134, 45], [211, 170], [170, 140], [140, 211], [67, 69], [69, 108], [108, 67], [43, 106], [106, 91], [91, 43], [230, 119], [119, 120], [120, 230], [226, 130], [130, 247], [247, 226], [63, 53], [53, 52], [52, 63], [238, 20], [20, 242], [242, 238], [46, 70], [70, 156], [156, 46], [78, 62], [62, 96], [96, 78], [46, 53], [53, 63], [63, 46], [143, 34], [34, 227], [227, 143], [123, 117], [117, 111], [111, 123], [44, 125], [125, 19], [19, 44], [236, 134], [134, 51], [51, 236], [216, 206], [206, 205], [205, 216], [154, 153], [153, 22], [22, 154], [39, 37], [37, 167], [167, 39], [200, 201], [201, 208], [208, 200], [36, 142], [142, 100], [100, 36], [57, 212], [212, 202], [202, 57], [20, 60], [60, 99], [99, 20], [28, 158], [158, 157], [157, 28], [35, 226], [226, 113], [113, 35], [160, 159], [159, 27], [27, 160], [204, 202], [202, 210], [210, 204], [113, 225], [225, 46], [46, 113], [43, 202], [202, 204], [204, 43], [62, 76], [76, 77], [77, 62], [137, 123], [123, 116], [116, 137], [41, 38], [38, 72], [72, 41], [203, 129], [129, 142], [142, 203], [64, 98], [98, 240], [240, 64], [49, 102], [102, 64], [64, 49], [41, 73], [73, 74], [74, 41], [212, 216], [216, 207], [207, 212], [42, 74], [74, 184], [184, 42], [169, 170], [170, 211], [211, 169], [170, 149], [149, 176], [176, 170], [105, 66], [66, 69], [69, 105], [122, 6], [6, 168], [168, 122], [123, 147], [147, 187], [187, 123], [96, 77], [77, 90], [90, 96], [65, 55], [55, 107], [107, 65], [89, 90], [90, 180], [180, 89], [101, 100], [100, 120], [120, 101], [63, 105], [105, 104], [104, 63], [93, 137], [137, 227], [227, 93], [15, 86], [86, 85], [85, 15], [129, 102], [102, 49], [49, 129], [14, 87], [87, 86], [86, 14], [55, 8], [8, 9], [9, 55], [100, 47], [47, 121], [121, 100], [145, 23], [23, 22], [22, 145], [88, 89], [89, 179], [179, 88], [6, 122], [122, 196], [196, 6], [88, 95], [95, 96], [96, 88], [138, 172], [172, 136], [136, 138], [215, 58], [58, 172], [172, 215], [115, 48], [48, 219], [219, 115], [42, 80], [80, 81], [81, 42], [195, 3], [3, 51], [51, 195], [43, 146], [146, 61], [61, 43], [171, 175], [175, 199], [199, 171], [81, 82], [82, 38], [38, 81], [53, 46], [46, 225], [225, 53], [144, 163], [163, 110], [110, 144], [52, 65], [65, 66], [66, 52], [229, 228], [228, 117], [117, 229], [34, 127], [127, 234], [234, 34], [107, 108], [108, 69], [69, 107], [109, 108], [108, 151], [151, 109], [48, 64], [64, 235], [235, 48], [62, 78], [78, 191], [191, 62], [129, 209], [209, 126], [126, 129], [111, 35], [35, 143], [143, 111], [117, 123], [123, 50], [50, 117], [222, 65], [65, 52], [52, 222], [19, 125], [125, 141], [141, 19], [221, 55], [55, 65], [65, 221], [3, 195], [195, 197], [197, 3], [25, 7], [7, 33], [33, 25], [220, 237], [237, 44], [44, 220], [70, 71], [71, 139], [139, 70], [122, 193], [193, 245], [245, 122], [247, 130], [130, 33], [33, 247], [71, 21], [21, 162], [162, 71], [170, 169], [169, 150], [150, 170], [188, 174], [174, 196], [196, 188], [216, 186], [186, 92], [92, 216], [2, 97], [97, 167], [167, 2], [141, 125], [125, 241], [241, 141], [164, 167], [167, 37], [37, 164], [72, 38], [38, 12], [12, 72], [38, 82], [82, 13], [13, 38], [63, 68], [68, 71], [71, 63], [226, 35], [35, 111], [111, 226], [101, 50], [50, 205], [205, 101], [206, 92], [92, 165], [165, 206], [209, 198], [198, 217], [217, 209], [165, 167], [167, 97], [97, 165], [220, 115], [115, 218], [218, 220], [133, 112], [112, 243], [243, 133], [239, 238], [238, 241], [241, 239], [214, 135], [135, 169], [169, 214], [190, 173], [173, 133], [133, 190], [171, 208], [208, 32], [32, 171], [125, 44], [44, 237], [237, 125], [86, 87], [87, 178], [178, 86], [85, 86], [86, 179], [179, 85], [84, 85], [85, 180], [180, 84], [83, 84], [84, 181], [181, 83], [201, 83], [83, 182], [182, 201], [137, 93], [93, 132], [132, 137], [76, 62], [62, 183], [183, 76], [61, 76], [76, 184], [184, 61], [57, 61], [61, 185], [185, 57], [212, 57], [57, 186], [186, 212], [214, 207], [207, 187], [187, 214], [34, 143], [143, 156], [156, 34], [79, 239], [239, 237], [237, 79], [123, 137], [137, 177], [177, 123], [44, 1], [1, 4], [4, 44], [201, 194], [194, 32], [32, 201], [64, 102], [102, 129], [129, 64], [213, 215], [215, 138], [138, 213], [59, 166], [166, 219], [219, 59], [242, 99], [99, 97], [97, 242], [2, 94], [94, 141], [141, 2], [75, 59], [59, 235], [235, 75], [24, 110], [110, 228], [228, 24], [25, 130], [130, 226], [226, 25], [23, 24], [24, 229], [229, 23], [22, 23], [23, 230], [230, 22], [26, 22], [22, 231], [231, 26], [112, 26], [26, 232], [232, 112], [189, 190], [190, 243], [243, 189], [221, 56], [56, 190], [190, 221], [28, 56], [56, 221], [221, 28], [27, 28], [28, 222], [222, 27], [29, 27], [27, 223], [223, 29], [30, 29], [29, 224], [224, 30], [247, 30], [30, 225], [225, 247], [238, 79], [79, 20], [20, 238], [166, 59], [59, 75], [75, 166], [60, 75], [75, 240], [240, 60], [147, 177], [177, 215], [215, 147], [20, 79], [79, 166], [166, 20], [187, 147], [147, 213], [213, 187], [112, 233], [233, 244], [244, 112], [233, 128], [128, 245], [245, 233], [128, 114], [114, 188], [188, 128], [114, 217], [217, 174], [174, 114], [131, 115], [115, 220], [220, 131], [217, 198], [198, 236], [236, 217], [198, 131], [131, 134], [134, 198], [177, 132], [132, 58], [58, 177], [143, 35], [35, 124], [124, 143], [110, 163], [163, 7], [7, 110], [228, 110], [110, 25], [25, 228], [356, 389], [389, 368], [368, 356], [11, 302], [302, 267], [267, 11], [452, 350], [350, 349], [349, 452], [302, 303], [303, 269], [269, 302], [357, 343], [343, 277], [277, 357], [452, 453], [453, 357], [357, 452], [333, 332], [332, 297], [297, 333], [175, 152], [152, 377], [377, 175], [347, 348], [348, 330], [330, 347], [303, 304], [304, 270], [270, 303], [9, 336], [336, 337], [337, 9], [278, 279], [279, 360], [360, 278], [418, 262], [262, 431], [431, 418], [304, 408], [408, 409], [409, 304], [310, 415], [415, 407], [407, 310], [270, 409], [409, 410], [410, 270], [450, 348], [348, 347], [347, 450], [422, 430], [430, 434], [434, 422], [313, 314], [314, 17], [17, 313], [306, 307], [307, 375], [375, 306], [387, 388], [388, 260], [260, 387], [286, 414], [414, 398], [398, 286], [335, 406], [406, 418], [418, 335], [364, 367], [367, 416], [416, 364], [423, 358], [358, 327], [327, 423], [251, 284], [284, 298], [298, 251], [281, 5], [5, 4], [4, 281], [373, 374], [374, 253], [253, 373], [307, 320], [320, 321], [321, 307], [425, 427], [427, 411], [411, 425], [421, 313], [313, 18], [18, 421], [321, 405], [405, 406], [406, 321], [320, 404], [404, 405], [405, 320], [315, 16], [16, 17], [17, 315], [426, 425], [425, 266], [266, 426], [377, 400], [400, 369], [369, 377], [322, 391], [391, 269], [269, 322], [417, 465], [465, 464], [464, 417], [386, 257], [257, 258], [258, 386], [466, 260], [260, 388], [388, 466], [456, 399], [399, 419], [419, 456], [284, 332], [332, 333], [333, 284], [417, 285], [285, 8], [8, 417], [346, 340], [340, 261], [261, 346], [413, 441], [441, 285], [285, 413], [327, 460], [460, 328], [328, 327], [355, 371], [371, 329], [329, 355], [392, 439], [439, 438], [438, 392], [382, 341], [341, 256], [256, 382], [429, 420], [420, 360], [360, 429], [364, 394], [394, 379], [379, 364], [277, 343], [343, 437], [437, 277], [443, 444], [444, 283], [283, 443], [275, 440], [440, 363], [363, 275], [431, 262], [262, 369], [369, 431], [297, 338], [338, 337], [337, 297], [273, 375], [375, 321], [321, 273], [450, 451], [451, 349], [349, 450], [446, 342], [342, 467], [467, 446], [293, 334], [334, 282], [282, 293], [458, 461], [461, 462], [462, 458], [276, 353], [353, 383], [383, 276], [308, 324], [324, 325], [325, 308], [276, 300], [300, 293], [293, 276], [372, 345], [345, 447], [447, 372], [352, 345], [345, 340], [340, 352], [274, 1], [1, 19], [19, 274], [456, 248], [248, 281], [281, 456], [436, 427], [427, 425], [425, 436], [381, 256], [256, 252], [252, 381], [269, 391], [391, 393], [393, 269], [200, 199], [199, 428], [428, 200], [266, 330], [330, 329], [329, 266], [287, 273], [273, 422], [422, 287], [250, 462], [462, 328], [328, 250], [258, 286], [286, 384], [384, 258], [265, 353], [353, 342], [342, 265], [387, 259], [259, 257], [257, 387], [424, 431], [431, 430], [430, 424], [342, 353], [353, 276], [276, 342], [273, 335], [335, 424], [424, 273], [292, 325], [325, 307], [307, 292], [366, 447], [447, 345], [345, 366], [271, 303], [303, 302], [302, 271], [423, 266], [266, 371], [371, 423], [294, 455], [455, 460], [460, 294], [279, 278], [278, 294], [294, 279], [271, 272], [272, 304], [304, 271], [432, 434], [434, 427], [427, 432], [272, 407], [407, 408], [408, 272], [394, 430], [430, 431], [431, 394], [395, 369], [369, 400], [400, 395], [334, 333], [333, 299], [299, 334], [351, 417], [417, 168], [168, 351], [352, 280], [280, 411], [411, 352], [325, 319], [319, 320], [320, 325], [295, 296], [296, 336], [336, 295], [319, 403], [403, 404], [404, 319], [330, 348], [348, 349], [349, 330], [293, 298], [298, 333], [333, 293], [323, 454], [454, 447], [447, 323], [15, 16], [16, 315], [315, 15], [358, 429], [429, 279], [279, 358], [14, 15], [15, 316], [316, 14], [285, 336], [336, 9], [9, 285], [329, 349], [349, 350], [350, 329], [374, 380], [380, 252], [252, 374], [318, 402], [402, 403], [403, 318], [6, 197], [197, 419], [419, 6], [318, 319], [319, 325], [325, 318], [367, 364], [364, 365], [365, 367], [435, 367], [367, 397], [397, 435], [344, 438], [438, 439], [439, 344], [272, 271], [271, 311], [311, 272], [195, 5], [5, 281], [281, 195], [273, 287], [287, 291], [291, 273], [396, 428], [428, 199], [199, 396], [311, 271], [271, 268], [268, 311], [283, 444], [444, 445], [445, 283], [373, 254], [254, 339], [339, 373], [282, 334], [334, 296], [296, 282], [449, 347], [347, 346], [346, 449], [264, 447], [447, 454], [454, 264], [336, 296], [296, 299], [299, 336], [338, 10], [10, 151], [151, 338], [278, 439], [439, 455], [455, 278], [292, 407], [407, 415], [415, 292], [358, 371], [371, 355], [355, 358], [340, 345], [345, 372], [372, 340], [346, 347], [347, 280], [280, 346], [442, 443], [443, 282], [282, 442], [19, 94], [94, 370], [370, 19], [441, 442], [442, 295], [295, 441], [248, 419], [419, 197], [197, 248], [263, 255], [255, 359], [359, 263], [440, 275], [275, 274], [274, 440], [300, 383], [383, 368], [368, 300], [351, 412], [412, 465], [465, 351], [263, 467], [467, 466], [466, 263], [301, 368], [368, 389], [389, 301], [395, 378], [378, 379], [379, 395], [412, 351], [351, 419], [419, 412], [436, 426], [426, 322], [322, 436], [2, 164], [164, 393], [393, 2], [370, 462], [462, 461], [461, 370], [164, 0], [0, 267], [267, 164], [302, 11], [11, 12], [12, 302], [268, 12], [12, 13], [13, 268], [293, 300], [300, 301], [301, 293], [446, 261], [261, 340], [340, 446], [330, 266], [266, 425], [425, 330], [426, 423], [423, 391], [391, 426], [429, 355], [355, 437], [437, 429], [391, 327], [327, 326], [326, 391], [440, 457], [457, 438], [438, 440], [341, 382], [382, 362], [362, 341], [459, 457], [457, 461], [461, 459], [434, 430], [430, 394], [394, 434], [414, 463], [463, 362], [362, 414], [396, 369], [369, 262], [262, 396], [354, 461], [461, 457], [457, 354], [316, 403], [403, 402], [402, 316], [315, 404], [404, 403], [403, 315], [314, 405], [405, 404], [404, 314], [313, 406], [406, 405], [405, 313], [421, 418], [418, 406], [406, 421], [366, 401], [401, 361], [361, 366], [306, 408], [408, 407], [407, 306], [291, 409], [409, 408], [408, 291], [287, 410], [410, 409], [409, 287], [432, 436], [436, 410], [410, 432], [434, 416], [416, 411], [411, 434], [264, 368], [368, 383], [383, 264], [309, 438], [438, 457], [457, 309], [352, 376], [376, 401], [401, 352], [274, 275], [275, 4], [4, 274], [421, 428], [428, 262], [262, 421], [294, 327], [327, 358], [358, 294], [433, 416], [416, 367], [367, 433], [289, 455], [455, 439], [439, 289], [462, 370], [370, 326], [326, 462], [2, 326], [326, 370], [370, 2], [305, 460], [460, 455], [455, 305], [254, 449], [449, 448], [448, 254], [255, 261], [261, 446], [446, 255], [253, 450], [450, 449], [449, 253], [252, 451], [451, 450], [450, 252], [256, 452], [452, 451], [451, 256], [341, 453], [453, 452], [452, 341], [413, 464], [464, 463], [463, 413], [441, 413], [413, 414], [414, 441], [258, 442], [442, 441], [441, 258], [257, 443], [443, 442], [442, 257], [259, 444], [444, 443], [443, 259], [260, 445], [445, 444], [444, 260], [467, 342], [342, 445], [445, 467], [459, 458], [458, 250], [250, 459], [289, 392], [392, 290], [290, 289], [290, 328], [328, 460], [460, 290], [376, 433], [433, 435], [435, 376], [250, 290], [290, 392], [392, 250], [411, 416], [416, 433], [433, 411], [341, 463], [463, 464], [464, 341], [453, 464], [464, 465], [465, 453], [357, 465], [465, 412], [412, 357], [343, 412], [412, 399], [399, 343], [360, 363], [363, 440], [440, 360], [437, 399], [399, 456], [456, 437], [420, 456], [456, 363], [363, 420], [401, 435], [435, 288], [288, 401], [372, 383], [383, 353], [353, 372], [339, 255], [255, 249], [249, 339], [448, 261], [261, 255], [255, 448], [133, 243], [243, 190], [190, 133], [133, 155], [155, 112], [112, 133], [33, 246], [246, 247], [247, 33], [33, 130], [130, 25], [25, 33], [398, 384], [384, 286], [286, 398], [362, 398], [398, 414], [414, 362], [362, 463], [463, 341], [341, 362], [263, 359], [359, 467], [467, 263], [263, 249], [249, 255], [255, 263], [466, 467], [467, 260], [260, 466], [75, 60], [60, 166], [166, 75], [238, 239], [239, 79], [79, 238], [162, 127], [127, 139], [139, 162], [72, 11], [11, 37], [37, 72], [121, 232], [232, 120], [120, 121], [73, 72], [72, 39], [39, 73], [114, 128], [128, 47], [47, 114], [233, 232], [232, 128], [128, 233], [103, 104], [104, 67], [67, 103], [152, 175], [175, 148], [148, 152], [119, 118], [118, 101], [101, 119], [74, 73], [73, 40], [40, 74], [107, 9], [9, 108], [108, 107], [49, 48], [48, 131], [131, 49], [32, 194], [194, 211], [211, 32], [184, 74], [74, 185], [185, 184], [191, 80], [80, 183], [183, 191], [185, 40], [40, 186], [186, 185], [119, 230], [230, 118], [118, 119], [210, 202], [202, 214], [214, 210], [84, 83], [83, 17], [17, 84], [77, 76], [76, 146], [146, 77], [161, 160], [160, 30], [30, 161], [190, 56], [56, 173], [173, 190], [182, 106], [106, 194], [194, 182], [138, 135], [135, 192], [192, 138], [129, 203], [203, 98], [98, 129], [54, 21], [21, 68], [68, 54], [5, 51], [51, 4], [4, 5], [145, 144], [144, 23], [23, 145], [90, 77], [77, 91], [91, 90], [207, 205], [205, 187], [187, 207], [83, 201], [201, 18], [18, 83], [181, 91], [91, 182], [182, 181], [180, 90], [90, 181], [181, 180], [16, 85], [85, 17], [17, 16], [205, 206], [206, 36], [36, 205], [176, 148], [148, 140], [140, 176], [165, 92], [92, 39], [39, 165], [245, 193], [193, 244], [244, 245], [27, 159], [159, 28], [28, 27], [30, 247], [247, 161], [161, 30], [174, 236], [236, 196], [196, 174], [103, 54], [54, 104], [104, 103], [55, 193], [193, 8], [8, 55], [111, 117], [117, 31], [31, 111], [221, 189], [189, 55], [55, 221], [240, 98], [98, 99], [99, 240], [142, 126], [126, 100], [100, 142], [219, 166], [166, 218], [218, 219], [112, 155], [155, 26], [26, 112], [198, 209], [209, 131], [131, 198], [169, 135], [135, 150], [150, 169], [114, 47], [47, 217], [217, 114], [224, 223], [223, 53], [53, 224], [220, 45], [45, 134], [134, 220], [32, 211], [211, 140], [140, 32], [109, 67], [67, 108], [108, 109], [146, 43], [43, 91], [91, 146], [231, 230], [230, 120], [120, 231], [113, 226], [226, 247], [247, 113], [105, 63], [63, 52], [52, 105], [241, 238], [238, 242], [242, 241], [124, 46], [46, 156], [156, 124], [95, 78], [78, 96], [96, 95], [70, 46], [46, 63], [63, 70], [116, 143], [143, 227], [227, 116], [116, 123], [123, 111], [111, 116], [1, 44], [44, 19], [19, 1], [3, 236], [236, 51], [51, 3], [207, 216], [216, 205], [205, 207], [26, 154], [154, 22], [22, 26], [165, 39], [39, 167], [167, 165], [199, 200], [200, 208], [208, 199], [101, 36], [36, 100], [100, 101], [43, 57], [57, 202], [202, 43], [242, 20], [20, 99], [99, 242], [56, 28], [28, 157], [157, 56], [124, 35], [35, 113], [113, 124], [29, 160], [160, 27], [27, 29], [211, 204], [204, 210], [210, 211], [124, 113], [113, 46], [46, 124], [106, 43], [43, 204], [204, 106], [96, 62], [62, 77], [77, 96], [227, 137], [137, 116], [116, 227], [73, 41], [41, 72], [72, 73], [36, 203], [203, 142], [142, 36], [235, 64], [64, 240], [240, 235], [48, 49], [49, 64], [64, 48], [42, 41], [41, 74], [74, 42], [214, 212], [212, 207], [207, 214], [183, 42], [42, 184], [184, 183], [210, 169], [169, 211], [211, 210], [140, 170], [170, 176], [176, 140], [104, 105], [105, 69], [69, 104], [193, 122], [122, 168], [168, 193], [50, 123], [123, 187], [187, 50], [89, 96], [96, 90], [90, 89], [66, 65], [65, 107], [107, 66], [179, 89], [89, 180], [180, 179], [119, 101], [101, 120], [120, 119], [68, 63], [63, 104], [104, 68], [234, 93], [93, 227], [227, 234], [16, 15], [15, 85], [85, 16], [209, 129], [129, 49], [49, 209], [15, 14], [14, 86], [86, 15], [107, 55], [55, 9], [9, 107], [120, 100], [100, 121], [121, 120], [153, 145], [145, 22], [22, 153], [178, 88], [88, 179], [179, 178], [197, 6], [6, 196], [196, 197], [89, 88], [88, 96], [96, 89], [135, 138], [138, 136], [136, 135], [138, 215], [215, 172], [172, 138], [218, 115], [115, 219], [219, 218], [41, 42], [42, 81], [81, 41], [5, 195], [195, 51], [51, 5], [57, 43], [43, 61], [61, 57], [208, 171], [171, 199], [199, 208], [41, 81], [81, 38], [38, 41], [224, 53], [53, 225], [225, 224], [24, 144], [144, 110], [110, 24], [105, 52], [52, 66], [66, 105], [118, 229], [229, 117], [117, 118], [227, 34], [34, 234], [234, 227], [66, 107], [107, 69], [69, 66], [10, 109], [109, 151], [151, 10], [219, 48], [48, 235], [235, 219], [183, 62], [62, 191], [191, 183], [142, 129], [129, 126], [126, 142], [116, 111], [111, 143], [143, 116], [118, 117], [117, 50], [50, 118], [223, 222], [222, 52], [52, 223], [94, 19], [19, 141], [141, 94], [222, 221], [221, 65], [65, 222], [196, 3], [3, 197], [197, 196], [45, 220], [220, 44], [44, 45], [156, 70], [70, 139], [139, 156], [188, 122], [122, 245], [245, 188], [139, 71], [71, 162], [162, 139], [149, 170], [170, 150], [150, 149], [122, 188], [188, 196], [196, 122], [206, 216], [216, 92], [92, 206], [164, 2], [2, 167], [167, 164], [242, 141], [141, 241], [241, 242], [0, 164], [164, 37], [37, 0], [11, 72], [72, 12], [12, 11], [12, 38], [38, 13], [13, 12], [70, 63], [63, 71], [71, 70], [31, 226], [226, 111], [111, 31], [36, 101], [101, 205], [205, 36], [203, 206], [206, 165], [165, 203], [126, 209], [209, 217], [217, 126], [98, 165], [165, 97], [97, 98], [237, 220], [220, 218], [218, 237], [237, 239], [239, 241], [241, 237], [210, 214], [214, 169], [169, 210], [140, 171], [171, 32], [32, 140], [241, 125], [125, 237], [237, 241], [179, 86], [86, 178], [178, 179], [180, 85], [85, 179], [179, 180], [181, 84], [84, 180], [180, 181], [182, 83], [83, 181], [181, 182], [194, 201], [201, 182], [182, 194], [177, 137], [137, 132], [132, 177], [184, 76], [76, 183], [183, 184], [185, 61], [61, 184], [184, 185], [186, 57], [57, 185], [185, 186], [216, 212], [212, 186], [186, 216], [192, 214], [214, 187], [187, 192], [139, 34], [34, 156], [156, 139], [218, 79], [79, 237], [237, 218], [147, 123], [123, 177], [177, 147], [45, 44], [44, 4], [4, 45], [208, 201], [201, 32], [32, 208], [98, 64], [64, 129], [129, 98], [192, 213], [213, 138], [138, 192], [235, 59], [59, 219], [219, 235], [141, 242], [242, 97], [97, 141], [97, 2], [2, 141], [141, 97], [240, 75], [75, 235], [235, 240], [229, 24], [24, 228], [228, 229], [31, 25], [25, 226], [226, 31], [230, 23], [23, 229], [229, 230], [231, 22], [22, 230], [230, 231], [232, 26], [26, 231], [231, 232], [233, 112], [112, 232], [232, 233], [244, 189], [189, 243], [243, 244], [189, 221], [221, 190], [190, 189], [222, 28], [28, 221], [221, 222], [223, 27], [27, 222], [222, 223], [224, 29], [29, 223], [223, 224], [225, 30], [30, 224], [224, 225], [113, 247], [247, 225], [225, 113], [99, 60], [60, 240], [240, 99], [213, 147], [147, 215], [215, 213], [60, 20], [20, 166], [166, 60], [192, 187], [187, 213], [213, 192], [243, 112], [112, 244], [244, 243], [244, 233], [233, 245], [245, 244], [245, 128], [128, 188], [188, 245], [188, 114], [114, 174], [174, 188], [134, 131], [131, 220], [220, 134], [174, 217], [217, 236], [236, 174], [236, 198], [198, 134], [134, 236], [215, 177], [177, 58], [58, 215], [156, 143], [143, 124], [124, 156], [25, 110], [110, 7], [7, 25], [31, 228], [228, 25], [25, 31], [264, 356], [356, 368], [368, 264], [0, 11], [11, 267], [267, 0], [451, 452], [452, 349], [349, 451], [267, 302], [302, 269], [269, 267], [350, 357], [357, 277], [277, 350], [350, 452], [452, 357], [357, 350], [299, 333], [333, 297], [297, 299], [396, 175], [175, 377], [377, 396], [280, 347], [347, 330], [330, 280], [269, 303], [303, 270], [270, 269], [151, 9], [9, 337], [337, 151], [344, 278], [278, 360], [360, 344], [424, 418], [418, 431], [431, 424], [270, 304], [304, 409], [409, 270], [272, 310], [310, 407], [407, 272], [322, 270], [270, 410], [410, 322], [449, 450], [450, 347], [347, 449], [432, 422], [422, 434], [434, 432], [18, 313], [313, 17], [17, 18], [291, 306], [306, 375], [375, 291], [259, 387], [387, 260], [260, 259], [424, 335], [335, 418], [418, 424], [434, 364], [364, 416], [416, 434], [391, 423], [423, 327], [327, 391], [301, 251], [251, 298], [298, 301], [275, 281], [281, 4], [4, 275], [254, 373], [373, 253], [253, 254], [375, 307], [307, 321], [321, 375], [280, 425], [425, 411], [411, 280], [200, 421], [421, 18], [18, 200], [335, 321], [321, 406], [406, 335], [321, 320], [320, 405], [405, 321], [314, 315], [315, 17], [17, 314], [423, 426], [426, 266], [266, 423], [396, 377], [377, 369], [369, 396], [270, 322], [322, 269], [269, 270], [413, 417], [417, 464], [464, 413], [385, 386], [386, 258], [258, 385], [248, 456], [456, 419], [419, 248], [298, 284], [284, 333], [333, 298], [168, 417], [417, 8], [8, 168], [448, 346], [346, 261], [261, 448], [417, 413], [413, 285], [285, 417], [326, 327], [327, 328], [328, 326], [277, 355], [355, 329], [329, 277], [309, 392], [392, 438], [438, 309], [381, 382], [382, 256], [256, 381], [279, 429], [429, 360], [360, 279], [365, 364], [364, 379], [379, 365], [355, 277], [277, 437], [437, 355], [282, 443], [443, 283], [283, 282], [281, 275], [275, 363], [363, 281], [395, 431], [431, 369], [369, 395], [299, 297], [297, 337], [337, 299], [335, 273], [273, 321], [321, 335], [348, 450], [450, 349], [349, 348], [359, 446], [446, 467], [467, 359], [283, 293], [293, 282], [282, 283], [250, 458], [458, 462], [462, 250], [300, 276], [276, 383], [383, 300], [292, 308], [308, 325], [325, 292], [283, 276], [276, 293], [293, 283], [264, 372], [372, 447], [447, 264], [346, 352], [352, 340], [340, 346], [354, 274], [274, 19], [19, 354], [363, 456], [456, 281], [281, 363], [426, 436], [436, 425], [425, 426], [380, 381], [381, 252], [252, 380], [267, 269], [269, 393], [393, 267], [421, 200], [200, 428], [428, 421], [371, 266], [266, 329], [329, 371], [432, 287], [287, 422], [422, 432], [290, 250], [250, 328], [328, 290], [385, 258], [258, 384], [384, 385], [446, 265], [265, 342], [342, 446], [386, 387], [387, 257], [257, 386], [422, 424], [424, 430], [430, 422], [445, 342], [342, 276], [276, 445], [422, 273], [273, 424], [424, 422], [306, 292], [292, 307], [307, 306], [352, 366], [366, 345], [345, 352], [268, 271], [271, 302], [302, 268], [358, 423], [423, 371], [371, 358], [327, 294], [294, 460], [460, 327], [331, 279], [279, 294], [294, 331], [303, 271], [271, 304], [304, 303], [436, 432], [432, 427], [427, 436], [304, 272], [272, 408], [408, 304], [395, 394], [394, 431], [431, 395], [378, 395], [395, 400], [400, 378], [296, 334], [334, 299], [299, 296], [6, 351], [351, 168], [168, 6], [376, 352], [352, 411], [411, 376], [307, 325], [325, 320], [320, 307], [285, 295], [295, 336], [336, 285], [320, 319], [319, 404], [404, 320], [329, 330], [330, 349], [349, 329], [334, 293], [293, 333], [333, 334], [366, 323], [323, 447], [447, 366], [316, 15], [15, 315], [315, 316], [331, 358], [358, 279], [279, 331], [317, 14], [14, 316], [316, 317], [8, 285], [285, 9], [9, 8], [277, 329], [329, 350], [350, 277], [253, 374], [374, 252], [252, 253], [319, 318], [318, 403], [403, 319], [351, 6], [6, 419], [419, 351], [324, 318], [318, 325], [325, 324], [397, 367], [367, 365], [365, 397], [288, 435], [435, 397], [397, 288], [278, 344], [344, 439], [439, 278], [310, 272], [272, 311], [311, 310], [248, 195], [195, 281], [281, 248], [375, 273], [273, 291], [291, 375], [175, 396], [396, 199], [199, 175], [312, 311], [311, 268], [268, 312], [276, 283], [283, 445], [445, 276], [390, 373], [373, 339], [339, 390], [295, 282], [282, 296], [296, 295], [448, 449], [449, 346], [346, 448], [356, 264], [264, 454], [454, 356], [337, 336], [336, 299], [299, 337], [337, 338], [338, 151], [151, 337], [294, 278], [278, 455], [455, 294], [308, 292], [292, 415], [415, 308], [429, 358], [358, 355], [355, 429], [265, 340], [340, 372], [372, 265], [352, 346], [346, 280], [280, 352], [295, 442], [442, 282], [282, 295], [354, 19], [19, 370], [370, 354], [285, 441], [441, 295], [295, 285], [195, 248], [248, 197], [197, 195], [457, 440], [440, 274], [274, 457], [301, 300], [300, 368], [368, 301], [417, 351], [351, 465], [465, 417], [251, 301], [301, 389], [389, 251], [394, 395], [395, 379], [379, 394], [399, 412], [412, 419], [419, 399], [410, 436], [436, 322], [322, 410], [326, 2], [2, 393], [393, 326], [354, 370], [370, 461], [461, 354], [393, 164], [164, 267], [267, 393], [268, 302], [302, 12], [12, 268], [312, 268], [268, 13], [13, 312], [298, 293], [293, 301], [301, 298], [265, 446], [446, 340], [340, 265], [280, 330], [330, 425], [425, 280], [322, 426], [426, 391], [391, 322], [420, 429], [429, 437], [437, 420], [393, 391], [391, 326], [326, 393], [344, 440], [440, 438], [438, 344], [458, 459], [459, 461], [461, 458], [364, 434], [434, 394], [394, 364], [428, 396], [396, 262], [262, 428], [274, 354], [354, 457], [457, 274], [317, 316], [316, 402], [402, 317], [316, 315], [315, 403], [403, 316], [315, 314], [314, 404], [404, 315], [314, 313], [313, 405], [405, 314], [313, 421], [421, 406], [406, 313], [323, 366], [366, 361], [361, 323], [292, 306], [306, 407], [407, 292], [306, 291], [291, 408], [408, 306], [291, 287], [287, 409], [409, 291], [287, 432], [432, 410], [410, 287], [427, 434], [434, 411], [411, 427], [372, 264], [264, 383], [383, 372], [459, 309], [309, 457], [457, 459], [366, 352], [352, 401], [401, 366], [1, 274], [274, 4], [4, 1], [418, 421], [421, 262], [262, 418], [331, 294], [294, 358], [358, 331], [435, 433], [433, 367], [367, 435], [392, 289], [289, 439], [439, 392], [328, 462], [462, 326], [326, 328], [94, 2], [2, 370], [370, 94], [289, 305], [305, 455], [455, 289], [339, 254], [254, 448], [448, 339], [359, 255], [255, 446], [446, 359], [254, 253], [253, 449], [449, 254], [253, 252], [252, 450], [450, 253], [252, 256], [256, 451], [451, 252], [256, 341], [341, 452], [452, 256], [414, 413], [413, 463], [463, 414], [286, 441], [441, 414], [414, 286], [286, 258], [258, 441], [441, 286], [258, 257], [257, 442], [442, 258], [257, 259], [259, 443], [443, 257], [259, 260], [260, 444], [444, 259], [260, 467], [467, 445], [445, 260], [309, 459], [459, 250], [250, 309], [305, 289], [289, 290], [290, 305], [305, 290], [290, 460], [460, 305], [401, 376], [376, 435], [435, 401], [309, 250], [250, 392], [392, 309], [376, 411], [411, 433], [433, 376], [453, 341], [341, 464], [464, 453], [357, 453], [453, 465], [465, 357], [343, 357], [357, 412], [412, 343], [437, 343], [343, 399], [399, 437], [344, 360], [360, 440], [440, 344], [420, 437], [437, 456], [456, 420], [360, 420], [420, 363], [363, 360], [361, 401], [401, 288], [288, 361], [265, 372], [372, 353], [353, 265], [390, 339], [339, 249], [249, 390], [339, 448], [448, 255], [255, 339]);
function Rc(t2) {
  t2.j = { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] };
}
var Ic = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "image_in", "norm_rect", false), this.j = { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] }, this.outputFacialTransformationMatrixes = this.outputFaceBlendshapes = false, kn(t2 = this.h = new eo(), 0, 1, e2 = new Ks()), this.A = new to(), kn(this.h, 0, 3, this.A), this.u = new $s(), kn(this.h, 0, 2, this.u), Mn(this.u, 4, 1), Pn(this.u, 2, 0.5), Pn(this.A, 2, 0.5), Pn(this.h, 4, 0.5);
  }
  get baseOptions() {
    return wn(this.h, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.h, 0, 1, t2);
  }
  o(t2) {
    return "numFaces" in t2 && Mn(this.u, 4, t2.numFaces ?? 1), "minFaceDetectionConfidence" in t2 && Pn(this.u, 2, t2.minFaceDetectionConfidence ?? 0.5), "minTrackingConfidence" in t2 && Pn(this.h, 4, t2.minTrackingConfidence ?? 0.5), "minFacePresenceConfidence" in t2 && Pn(this.A, 2, t2.minFacePresenceConfidence ?? 0.5), "outputFaceBlendshapes" in t2 && (this.outputFaceBlendshapes = !!t2.outputFaceBlendshapes), "outputFacialTransformationMatrixes" in t2 && (this.outputFacialTransformationMatrixes = !!t2.outputFacialTransformationMatrixes), this.l(t2);
  }
  F(t2, e2) {
    return Rc(this), pc(this, t2, e2), this.j;
  }
  G(t2, e2, n2) {
    return Rc(this), gc(this, t2, n2, e2), this.j;
  }
  m() {
    var t2 = new gs();
    ds(t2, "image_in"), ds(t2, "norm_rect"), ps(t2, "face_landmarks");
    const e2 = new rs();
    Mr(e2, ro, this.h);
    const n2 = new cs();
    Cn(n2, 2, "mediapipe.tasks.vision.face_landmarker.FaceLandmarkerGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), as(n2, "NORM_LANDMARKS:face_landmarks"), n2.o(e2), fs(t2, n2), this.g.attachProtoVectorListener("face_landmarks", ((t3, e3) => {
      for (const e4 of t3) t3 = Rs(e4), this.j.faceLandmarks.push(Yo(t3));
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("face_landmarks", ((t3) => {
      pa(this, t3);
    })), this.outputFaceBlendshapes && (ps(t2, "blendshapes"), as(n2, "BLENDSHAPES:blendshapes"), this.g.attachProtoVectorListener("blendshapes", ((t3, e3) => {
      if (this.outputFaceBlendshapes) for (const e4 of t3) t3 = ws(e4), this.j.faceBlendshapes.push(Wo(t3.g() ?? []));
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("blendshapes", ((t3) => {
      pa(this, t3);
    }))), this.outputFacialTransformationMatrixes && (ps(t2, "face_geometry"), as(n2, "FACE_GEOMETRY:face_geometry"), this.g.attachProtoVectorListener("face_geometry", ((t3, e3) => {
      if (this.outputFacialTransformationMatrixes) for (const e4 of t3) (t3 = wn(t3 = Qs(e4), Is, 2)) && this.j.facialTransformationMatrixes.push({ rows: Rn(t3, 1) ?? 0 ?? 0, columns: Rn(t3, 2) ?? 0 ?? 0, data: on(t3, 3, Qt, sn()).slice() ?? [] });
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("face_geometry", ((t3) => {
      pa(this, t3);
    }))), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
Ic.prototype.detectForVideo = Ic.prototype.G, Ic.prototype.detect = Ic.prototype.F, Ic.prototype.setOptions = Ic.prototype.o, Ic.createFromModelPath = function(t2, e2) {
  return fc(Ic, t2, { baseOptions: { modelAssetPath: e2 } });
}, Ic.createFromModelBuffer = function(t2, e2) {
  return fc(Ic, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, Ic.createFromOptions = function(t2, e2) {
  return fc(Ic, t2, e2);
}, Ic.FACE_LANDMARKS_LIPS = vc, Ic.FACE_LANDMARKS_LEFT_EYE = Ec, Ic.FACE_LANDMARKS_LEFT_EYEBROW = wc, Ic.FACE_LANDMARKS_LEFT_IRIS = Tc, Ic.FACE_LANDMARKS_RIGHT_EYE = Ac, Ic.FACE_LANDMARKS_RIGHT_EYEBROW = bc, Ic.FACE_LANDMARKS_RIGHT_IRIS = kc, Ic.FACE_LANDMARKS_FACE_OVAL = Sc, Ic.FACE_LANDMARKS_CONTOURS = xc, Ic.FACE_LANDMARKS_TESSELATION = Lc;
var Fc = cc([0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]);
function Mc(t2) {
  t2.gestures = [], t2.landmarks = [], t2.worldLandmarks = [], t2.handedness = [];
}
function Pc(t2) {
  return 0 === t2.gestures.length ? { gestures: [], landmarks: [], worldLandmarks: [], handedness: [], handednesses: [] } : { gestures: t2.gestures, landmarks: t2.landmarks, worldLandmarks: t2.worldLandmarks, handedness: t2.handedness, handednesses: t2.handedness };
}
function Cc(t2, e2 = true) {
  const n2 = [];
  for (const i2 of t2) {
    var r2 = ws(i2);
    t2 = [];
    for (const n3 of r2.g()) r2 = e2 && null != Rn(n3, 1) ? Rn(n3, 1) ?? 0 : -1, t2.push({ score: Fn(n3, 2) ?? 0, index: r2, categoryName: ge(tn(n3, 3)) ?? "" ?? "", displayName: ge(tn(n3, 4)) ?? "" ?? "" });
    n2.push(t2);
  }
  return n2;
}
var Oc = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "image_in", "norm_rect", false), this.gestures = [], this.landmarks = [], this.worldLandmarks = [], this.handedness = [], kn(t2 = this.j = new uo(), 0, 1, e2 = new Ks()), this.u = new ho(), kn(this.j, 0, 2, this.u), this.D = new co(), kn(this.u, 0, 3, this.D), this.A = new ao(), kn(this.u, 0, 2, this.A), this.h = new oo(), kn(this.j, 0, 3, this.h), Pn(this.A, 2, 0.5), Pn(this.u, 4, 0.5), Pn(this.D, 2, 0.5);
  }
  get baseOptions() {
    return wn(this.j, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.j, 0, 1, t2);
  }
  o(t2) {
    if (Mn(this.A, 3, t2.numHands ?? 1), "minHandDetectionConfidence" in t2 && Pn(this.A, 2, t2.minHandDetectionConfidence ?? 0.5), "minTrackingConfidence" in t2 && Pn(this.u, 4, t2.minTrackingConfidence ?? 0.5), "minHandPresenceConfidence" in t2 && Pn(this.D, 2, t2.minHandPresenceConfidence ?? 0.5), t2.cannedGesturesClassifierOptions) {
      var e2 = new io(), n2 = e2, r2 = Xo(t2.cannedGesturesClassifierOptions, wn(this.h, io, 3)?.l());
      kn(n2, 0, 2, r2), kn(this.h, 0, 3, e2);
    } else void 0 === t2.cannedGesturesClassifierOptions && wn(this.h, io, 3)?.g();
    return t2.customGesturesClassifierOptions ? (kn(n2 = e2 = new io(), 0, 2, r2 = Xo(t2.customGesturesClassifierOptions, wn(this.h, io, 4)?.l())), kn(this.h, 0, 4, e2)) : void 0 === t2.customGesturesClassifierOptions && wn(this.h, io, 4)?.g(), this.l(t2);
  }
  Ha(t2, e2) {
    return Mc(this), pc(this, t2, e2), Pc(this);
  }
  Ia(t2, e2, n2) {
    return Mc(this), gc(this, t2, n2, e2), Pc(this);
  }
  m() {
    var t2 = new gs();
    ds(t2, "image_in"), ds(t2, "norm_rect"), ps(t2, "hand_gestures"), ps(t2, "hand_landmarks"), ps(t2, "world_hand_landmarks"), ps(t2, "handedness");
    const e2 = new rs();
    Mr(e2, mo, this.j);
    const n2 = new cs();
    Cn(n2, 2, "mediapipe.tasks.vision.gesture_recognizer.GestureRecognizerGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), as(n2, "HAND_GESTURES:hand_gestures"), as(n2, "LANDMARKS:hand_landmarks"), as(n2, "WORLD_LANDMARKS:world_hand_landmarks"), as(n2, "HANDEDNESS:handedness"), n2.o(e2), fs(t2, n2), this.g.attachProtoVectorListener("hand_landmarks", ((t3, e3) => {
      for (const e4 of t3) {
        t3 = Rs(e4);
        const n3 = [];
        for (const e5 of An(t3, Ls, 1)) n3.push({ x: Fn(e5, 1) ?? 0, y: Fn(e5, 2) ?? 0, z: Fn(e5, 3) ?? 0, visibility: Fn(e5, 4) ?? 0 });
        this.landmarks.push(n3);
      }
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("hand_landmarks", ((t3) => {
      pa(this, t3);
    })), this.g.attachProtoVectorListener("world_hand_landmarks", ((t3, e3) => {
      for (const e4 of t3) {
        t3 = xs(e4);
        const n3 = [];
        for (const e5 of An(t3, Ss, 1)) n3.push({ x: Fn(e5, 1) ?? 0, y: Fn(e5, 2) ?? 0, z: Fn(e5, 3) ?? 0, visibility: Fn(e5, 4) ?? 0 });
        this.worldLandmarks.push(n3);
      }
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("world_hand_landmarks", ((t3) => {
      pa(this, t3);
    })), this.g.attachProtoVectorListener("hand_gestures", ((t3, e3) => {
      this.gestures.push(...Cc(t3, false)), pa(this, e3);
    })), this.g.attachEmptyPacketListener("hand_gestures", ((t3) => {
      pa(this, t3);
    })), this.g.attachProtoVectorListener("handedness", ((t3, e3) => {
      this.handedness.push(...Cc(t3)), pa(this, e3);
    })), this.g.attachEmptyPacketListener("handedness", ((t3) => {
      pa(this, t3);
    })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
function Nc(t2) {
  return { landmarks: t2.landmarks, worldLandmarks: t2.worldLandmarks, handednesses: t2.handedness, handedness: t2.handedness };
}
Oc.prototype.recognizeForVideo = Oc.prototype.Ia, Oc.prototype.recognize = Oc.prototype.Ha, Oc.prototype.setOptions = Oc.prototype.o, Oc.createFromModelPath = function(t2, e2) {
  return fc(Oc, t2, { baseOptions: { modelAssetPath: e2 } });
}, Oc.createFromModelBuffer = function(t2, e2) {
  return fc(Oc, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, Oc.createFromOptions = function(t2, e2) {
  return fc(Oc, t2, e2);
}, Oc.HAND_CONNECTIONS = Fc;
var Uc = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "image_in", "norm_rect", false), this.landmarks = [], this.worldLandmarks = [], this.handedness = [], kn(t2 = this.h = new ho(), 0, 1, e2 = new Ks()), this.u = new co(), kn(this.h, 0, 3, this.u), this.j = new ao(), kn(this.h, 0, 2, this.j), Mn(this.j, 3, 1), Pn(this.j, 2, 0.5), Pn(this.u, 2, 0.5), Pn(this.h, 4, 0.5);
  }
  get baseOptions() {
    return wn(this.h, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.h, 0, 1, t2);
  }
  o(t2) {
    return "numHands" in t2 && Mn(this.j, 3, t2.numHands ?? 1), "minHandDetectionConfidence" in t2 && Pn(this.j, 2, t2.minHandDetectionConfidence ?? 0.5), "minTrackingConfidence" in t2 && Pn(this.h, 4, t2.minTrackingConfidence ?? 0.5), "minHandPresenceConfidence" in t2 && Pn(this.u, 2, t2.minHandPresenceConfidence ?? 0.5), this.l(t2);
  }
  F(t2, e2) {
    return this.landmarks = [], this.worldLandmarks = [], this.handedness = [], pc(this, t2, e2), Nc(this);
  }
  G(t2, e2, n2) {
    return this.landmarks = [], this.worldLandmarks = [], this.handedness = [], gc(this, t2, n2, e2), Nc(this);
  }
  m() {
    var t2 = new gs();
    ds(t2, "image_in"), ds(t2, "norm_rect"), ps(t2, "hand_landmarks"), ps(t2, "world_hand_landmarks"), ps(t2, "handedness");
    const e2 = new rs();
    Mr(e2, yo, this.h);
    const n2 = new cs();
    Cn(n2, 2, "mediapipe.tasks.vision.hand_landmarker.HandLandmarkerGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), as(n2, "LANDMARKS:hand_landmarks"), as(n2, "WORLD_LANDMARKS:world_hand_landmarks"), as(n2, "HANDEDNESS:handedness"), n2.o(e2), fs(t2, n2), this.g.attachProtoVectorListener("hand_landmarks", ((t3, e3) => {
      for (const e4 of t3) t3 = Rs(e4), this.landmarks.push(Yo(t3));
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("hand_landmarks", ((t3) => {
      pa(this, t3);
    })), this.g.attachProtoVectorListener("world_hand_landmarks", ((t3, e3) => {
      for (const e4 of t3) t3 = xs(e4), this.worldLandmarks.push(qo(t3));
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("world_hand_landmarks", ((t3) => {
      pa(this, t3);
    })), this.g.attachProtoVectorListener("handedness", ((t3, e3) => {
      var n3 = this.handedness, r2 = n3.push;
      const i2 = [];
      for (const e4 of t3) {
        t3 = ws(e4);
        const n4 = [];
        for (const e5 of t3.g()) n4.push({ score: Fn(e5, 2) ?? 0, index: Rn(e5, 1) ?? 0 ?? -1, categoryName: ge(tn(e5, 3)) ?? "" ?? "", displayName: ge(tn(e5, 4)) ?? "" ?? "" });
        i2.push(n4);
      }
      r2.call(n3, ...i2), pa(this, e3);
    })), this.g.attachEmptyPacketListener("handedness", ((t3) => {
      pa(this, t3);
    })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
Uc.prototype.detectForVideo = Uc.prototype.G, Uc.prototype.detect = Uc.prototype.F, Uc.prototype.setOptions = Uc.prototype.o, Uc.createFromModelPath = function(t2, e2) {
  return fc(Uc, t2, { baseOptions: { modelAssetPath: e2 } });
}, Uc.createFromModelBuffer = function(t2, e2) {
  return fc(Uc, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, Uc.createFromOptions = function(t2, e2) {
  return fc(Uc, t2, e2);
}, Uc.HAND_CONNECTIONS = Fc;
var Dc = cc([0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]);
function Bc(t2) {
  t2.h = { faceLandmarks: [], faceBlendshapes: [], poseLandmarks: [], poseWorldLandmarks: [], poseSegmentationMasks: [], leftHandLandmarks: [], leftHandWorldLandmarks: [], rightHandLandmarks: [], rightHandWorldLandmarks: [] };
}
function Gc(t2) {
  try {
    if (!t2.D) return t2.h;
    t2.D(t2.h);
  } finally {
    ya(t2);
  }
}
function jc(t2, e2) {
  t2 = Rs(t2), e2.push(Yo(t2));
}
var Vc = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "input_frames_image", null, false), this.h = { faceLandmarks: [], faceBlendshapes: [], poseLandmarks: [], poseWorldLandmarks: [], poseSegmentationMasks: [], leftHandLandmarks: [], leftHandWorldLandmarks: [], rightHandLandmarks: [], rightHandWorldLandmarks: [] }, this.outputPoseSegmentationMasks = this.outputFaceBlendshapes = false, kn(t2 = this.j = new wo(), 0, 1, e2 = new Ks()), this.I = new co(), kn(this.j, 0, 2, this.I), this.W = new _o(), kn(this.j, 0, 3, this.W), this.u = new $s(), kn(this.j, 0, 4, this.u), this.O = new to(), kn(this.j, 0, 5, this.O), this.A = new vo(), kn(this.j, 0, 6, this.A), this.M = new Eo(), kn(this.j, 0, 7, this.M), Pn(this.u, 2, 0.5), Pn(this.u, 3, 0.3), Pn(this.O, 2, 0.5), Pn(this.A, 2, 0.5), Pn(this.A, 3, 0.3), Pn(this.M, 2, 0.5), Pn(this.I, 2, 0.5);
  }
  get baseOptions() {
    return wn(this.j, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.j, 0, 1, t2);
  }
  o(t2) {
    return "minFaceDetectionConfidence" in t2 && Pn(this.u, 2, t2.minFaceDetectionConfidence ?? 0.5), "minFaceSuppressionThreshold" in t2 && Pn(this.u, 3, t2.minFaceSuppressionThreshold ?? 0.3), "minFacePresenceConfidence" in t2 && Pn(this.O, 2, t2.minFacePresenceConfidence ?? 0.5), "outputFaceBlendshapes" in t2 && (this.outputFaceBlendshapes = !!t2.outputFaceBlendshapes), "minPoseDetectionConfidence" in t2 && Pn(this.A, 2, t2.minPoseDetectionConfidence ?? 0.5), "minPoseSuppressionThreshold" in t2 && Pn(this.A, 3, t2.minPoseSuppressionThreshold ?? 0.3), "minPosePresenceConfidence" in t2 && Pn(this.M, 2, t2.minPosePresenceConfidence ?? 0.5), "outputPoseSegmentationMasks" in t2 && (this.outputPoseSegmentationMasks = !!t2.outputPoseSegmentationMasks), "minHandLandmarksConfidence" in t2 && Pn(this.I, 2, t2.minHandLandmarksConfidence ?? 0.5), this.l(t2);
  }
  F(t2, e2, n2) {
    const r2 = "function" != typeof e2 ? e2 : {};
    return this.D = "function" == typeof e2 ? e2 : n2, Bc(this), pc(this, t2, r2), Gc(this);
  }
  G(t2, e2, n2, r2) {
    const i2 = "function" != typeof n2 ? n2 : {};
    return this.D = "function" == typeof n2 ? n2 : r2, Bc(this), gc(this, t2, i2, e2), Gc(this);
  }
  m() {
    var t2 = new gs();
    ds(t2, "input_frames_image"), ps(t2, "pose_landmarks"), ps(t2, "pose_world_landmarks"), ps(t2, "face_landmarks"), ps(t2, "left_hand_landmarks"), ps(t2, "left_hand_world_landmarks"), ps(t2, "right_hand_landmarks"), ps(t2, "right_hand_world_landmarks");
    const e2 = new rs(), n2 = new Xi();
    Cn(n2, 1, "type.googleapis.com/mediapipe.tasks.vision.holistic_landmarker.proto.HolisticLandmarkerGraphOptions"), (function(t3, e3) {
      if (null != e3) if (Array.isArray(e3)) nn(t3, 2, Ce(e3, 0, Ne));
      else {
        if (!("string" == typeof e3 || e3 instanceof P || R(e3))) throw Error("invalid value in Any.value field: " + e3 + " expected a ByteString, a base64 encoded string, a Uint8Array or a jspb array");
        dn(t3, 2, lt(e3, false), F());
      }
    })(n2, this.j.g());
    const r2 = new cs();
    Cn(r2, 2, "mediapipe.tasks.vision.holistic_landmarker.HolisticLandmarkerGraph"), Ln(r2, 8, Xi, n2), os(r2, "IMAGE:input_frames_image"), as(r2, "POSE_LANDMARKS:pose_landmarks"), as(r2, "POSE_WORLD_LANDMARKS:pose_world_landmarks"), as(r2, "FACE_LANDMARKS:face_landmarks"), as(r2, "LEFT_HAND_LANDMARKS:left_hand_landmarks"), as(r2, "LEFT_HAND_WORLD_LANDMARKS:left_hand_world_landmarks"), as(r2, "RIGHT_HAND_LANDMARKS:right_hand_landmarks"), as(r2, "RIGHT_HAND_WORLD_LANDMARKS:right_hand_world_landmarks"), r2.o(e2), fs(t2, r2), ga(this, t2), this.g.attachProtoListener("pose_landmarks", ((t3, e3) => {
      jc(t3, this.h.poseLandmarks), pa(this, e3);
    })), this.g.attachEmptyPacketListener("pose_landmarks", ((t3) => {
      pa(this, t3);
    })), this.g.attachProtoListener("pose_world_landmarks", ((t3, e3) => {
      var n3 = this.h.poseWorldLandmarks;
      t3 = xs(t3), n3.push(qo(t3)), pa(this, e3);
    })), this.g.attachEmptyPacketListener("pose_world_landmarks", ((t3) => {
      pa(this, t3);
    })), this.outputPoseSegmentationMasks && (as(r2, "POSE_SEGMENTATION_MASK:pose_segmentation_mask"), ma(this, "pose_segmentation_mask"), this.g.Z("pose_segmentation_mask", ((t3, e3) => {
      this.h.poseSegmentationMasks = [mc(this, t3, true, !this.D)], pa(this, e3);
    })), this.g.attachEmptyPacketListener("pose_segmentation_mask", ((t3) => {
      this.h.poseSegmentationMasks = [], pa(this, t3);
    }))), this.g.attachProtoListener("face_landmarks", ((t3, e3) => {
      jc(t3, this.h.faceLandmarks), pa(this, e3);
    })), this.g.attachEmptyPacketListener("face_landmarks", ((t3) => {
      pa(this, t3);
    })), this.outputFaceBlendshapes && (ps(t2, "extra_blendshapes"), as(r2, "FACE_BLENDSHAPES:extra_blendshapes"), this.g.attachProtoListener("extra_blendshapes", ((t3, e3) => {
      var n3 = this.h.faceBlendshapes;
      this.outputFaceBlendshapes && (t3 = ws(t3), n3.push(Wo(t3.g() ?? []))), pa(this, e3);
    })), this.g.attachEmptyPacketListener("extra_blendshapes", ((t3) => {
      pa(this, t3);
    }))), this.g.attachProtoListener("left_hand_landmarks", ((t3, e3) => {
      jc(t3, this.h.leftHandLandmarks), pa(this, e3);
    })), this.g.attachEmptyPacketListener("left_hand_landmarks", ((t3) => {
      pa(this, t3);
    })), this.g.attachProtoListener("left_hand_world_landmarks", ((t3, e3) => {
      var n3 = this.h.leftHandWorldLandmarks;
      t3 = xs(t3), n3.push(qo(t3)), pa(this, e3);
    })), this.g.attachEmptyPacketListener("left_hand_world_landmarks", ((t3) => {
      pa(this, t3);
    })), this.g.attachProtoListener("right_hand_landmarks", ((t3, e3) => {
      jc(t3, this.h.rightHandLandmarks), pa(this, e3);
    })), this.g.attachEmptyPacketListener("right_hand_landmarks", ((t3) => {
      pa(this, t3);
    })), this.g.attachProtoListener("right_hand_world_landmarks", ((t3, e3) => {
      var n3 = this.h.rightHandWorldLandmarks;
      t3 = xs(t3), n3.push(qo(t3)), pa(this, e3);
    })), this.g.attachEmptyPacketListener("right_hand_world_landmarks", ((t3) => {
      pa(this, t3);
    })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
Vc.prototype.detectForVideo = Vc.prototype.G, Vc.prototype.detect = Vc.prototype.F, Vc.prototype.setOptions = Vc.prototype.o, Vc.createFromModelPath = function(t2, e2) {
  return fc(Vc, t2, { baseOptions: { modelAssetPath: e2 } });
}, Vc.createFromModelBuffer = function(t2, e2) {
  return fc(Vc, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, Vc.createFromOptions = function(t2, e2) {
  return fc(Vc, t2, e2);
}, Vc.HAND_CONNECTIONS = Fc, Vc.POSE_CONNECTIONS = Dc, Vc.FACE_LANDMARKS_LIPS = vc, Vc.FACE_LANDMARKS_LEFT_EYE = Ec, Vc.FACE_LANDMARKS_LEFT_EYEBROW = wc, Vc.FACE_LANDMARKS_LEFT_IRIS = Tc, Vc.FACE_LANDMARKS_RIGHT_EYE = Ac, Vc.FACE_LANDMARKS_RIGHT_EYEBROW = bc, Vc.FACE_LANDMARKS_RIGHT_IRIS = kc, Vc.FACE_LANDMARKS_FACE_OVAL = Sc, Vc.FACE_LANDMARKS_CONTOURS = xc, Vc.FACE_LANDMARKS_TESSELATION = Lc;
var Xc = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "input_image", "norm_rect", true), this.j = { classifications: [] }, kn(t2 = this.h = new bo(), 0, 1, e2 = new Ks());
  }
  get baseOptions() {
    return wn(this.h, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.h, 0, 1, t2);
  }
  o(t2) {
    return kn(this.h, 0, 2, Xo(t2, wn(this.h, Gs, 2))), this.l(t2);
  }
  sa(t2, e2) {
    return this.j = { classifications: [] }, pc(this, t2, e2), this.j;
  }
  ta(t2, e2, n2) {
    return this.j = { classifications: [] }, gc(this, t2, n2, e2), this.j;
  }
  m() {
    var t2 = new gs();
    ds(t2, "input_image"), ds(t2, "norm_rect"), ps(t2, "classifications");
    const e2 = new rs();
    Mr(e2, ko, this.h);
    const n2 = new cs();
    Cn(n2, 2, "mediapipe.tasks.vision.image_classifier.ImageClassifierGraph"), os(n2, "IMAGE:input_image"), os(n2, "NORM_RECT:norm_rect"), as(n2, "CLASSIFICATIONS:classifications"), n2.o(e2), fs(t2, n2), this.g.attachProtoListener("classifications", ((t3, e3) => {
      this.j = zo(Cs(t3)), pa(this, e3);
    })), this.g.attachEmptyPacketListener("classifications", ((t3) => {
      pa(this, t3);
    })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
Xc.prototype.classifyForVideo = Xc.prototype.ta, Xc.prototype.classify = Xc.prototype.sa, Xc.prototype.setOptions = Xc.prototype.o, Xc.createFromModelPath = function(t2, e2) {
  return fc(Xc, t2, { baseOptions: { modelAssetPath: e2 } });
}, Xc.createFromModelBuffer = function(t2, e2) {
  return fc(Xc, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, Xc.createFromOptions = function(t2, e2) {
  return fc(Xc, t2, e2);
};
var Hc = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "image_in", "norm_rect", true), this.h = new So(), this.embeddings = { embeddings: [] }, kn(t2 = this.h, 0, 1, e2 = new Ks());
  }
  get baseOptions() {
    return wn(this.h, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.h, 0, 1, t2);
  }
  o(t2) {
    var e2 = this.h, n2 = wn(this.h, Vs, 2);
    return n2 = n2 ? n2.clone() : new Vs(), void 0 !== t2.l2Normalize ? nn(n2, 1, te(t2.l2Normalize)) : "l2Normalize" in t2 && nn(n2, 1), void 0 !== t2.quantize ? nn(n2, 2, te(t2.quantize)) : "quantize" in t2 && nn(n2, 2), kn(e2, 0, 2, n2), this.l(t2);
  }
  za(t2, e2) {
    return pc(this, t2, e2), this.embeddings;
  }
  Aa(t2, e2, n2) {
    return gc(this, t2, n2, e2), this.embeddings;
  }
  m() {
    var t2 = new gs();
    ds(t2, "image_in"), ds(t2, "norm_rect"), ps(t2, "embeddings_out");
    const e2 = new rs();
    Mr(e2, xo, this.h);
    const n2 = new cs();
    Cn(n2, 2, "mediapipe.tasks.vision.image_embedder.ImageEmbedderGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), as(n2, "EMBEDDINGS:embeddings_out"), n2.o(e2), fs(t2, n2), this.g.attachProtoListener("embeddings_out", ((t3, e3) => {
      t3 = Bs(t3), this.embeddings = (function(t4) {
        return { embeddings: An(t4, Us, 1).map(((t5) => {
          const e4 = { headIndex: Rn(t5, 3) ?? 0 ?? -1, headName: ge(tn(t5, 4)) ?? "" ?? "" };
          var n3 = t5.v;
          return void 0 !== En(n3, 0 | n3[et], Os, gn(t5, 1)) ? (t5 = on(t5 = wn(t5, Os, gn(t5, 1), void 0), 1, Qt, sn()), e4.floatEmbedding = t5.slice()) : (n3 = new Uint8Array(0), e4.quantizedEmbedding = wn(t5, Ns, gn(t5, 2), void 0)?.na()?.h() ?? n3), e4;
        })), timestampMs: Ho(In(t4)) };
      })(t3), pa(this, e3);
    })), this.g.attachEmptyPacketListener("embeddings_out", ((t3) => {
      pa(this, t3);
    })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
Hc.cosineSimilarity = function(t2, e2) {
  if (t2.floatEmbedding && e2.floatEmbedding) t2 = Jo(t2.floatEmbedding, e2.floatEmbedding);
  else {
    if (!t2.quantizedEmbedding || !e2.quantizedEmbedding) throw Error("Cannot compute cosine similarity between quantized and float embeddings.");
    t2 = Jo($o(t2.quantizedEmbedding), $o(e2.quantizedEmbedding));
  }
  return t2;
}, Hc.prototype.embedForVideo = Hc.prototype.Aa, Hc.prototype.embed = Hc.prototype.za, Hc.prototype.setOptions = Hc.prototype.o, Hc.createFromModelPath = function(t2, e2) {
  return fc(Hc, t2, { baseOptions: { modelAssetPath: e2 } });
}, Hc.createFromModelBuffer = function(t2, e2) {
  return fc(Hc, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, Hc.createFromOptions = function(t2, e2) {
  return fc(Hc, t2, e2);
};
var Wc = class {
  constructor(t2, e2, n2) {
    this.confidenceMasks = t2, this.categoryMask = e2, this.qualityScores = n2;
  }
  close() {
    this.confidenceMasks?.forEach(((t2) => {
      t2.close();
    })), this.categoryMask?.close();
  }
};
function zc(t2) {
  const e2 = (function(t3) {
    return An(t3, cs, 1);
  })(t2.ca()).filter(((t3) => (ge(tn(t3, 1)) ?? "").includes("mediapipe.tasks.TensorsToSegmentationCalculator")));
  if (t2.u = [], e2.length > 1) throw Error("The graph has more than one mediapipe.tasks.TensorsToSegmentationCalculator.");
  1 === e2.length && (wn(e2[0], rs, 7)?.j()?.g() ?? /* @__PURE__ */ new Map()).forEach(((e3, n2) => {
    t2.u[Number(n2)] = ge(tn(e3, 1)) ?? "";
  }));
}
function Kc(t2) {
  t2.categoryMask = void 0, t2.confidenceMasks = void 0, t2.qualityScores = void 0;
}
function Yc(t2) {
  try {
    const e2 = new Wc(t2.confidenceMasks, t2.categoryMask, t2.qualityScores);
    if (!t2.j) return e2;
    t2.j(e2);
  } finally {
    ya(t2);
  }
}
Wc.prototype.close = Wc.prototype.close;
var qc = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "image_in", "norm_rect", false), this.u = [], this.outputCategoryMask = false, this.outputConfidenceMasks = true, this.h = new Mo(), this.A = new Lo(), kn(this.h, 0, 3, this.A), kn(t2 = this.h, 0, 1, e2 = new Ks());
  }
  get baseOptions() {
    return wn(this.h, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.h, 0, 1, t2);
  }
  o(t2) {
    return void 0 !== t2.displayNamesLocale ? nn(this.h, 2, pe(t2.displayNamesLocale)) : "displayNamesLocale" in t2 && nn(this.h, 2), "outputCategoryMask" in t2 && (this.outputCategoryMask = t2.outputCategoryMask ?? false), "outputConfidenceMasks" in t2 && (this.outputConfidenceMasks = t2.outputConfidenceMasks ?? true), super.l(t2);
  }
  L() {
    zc(this);
  }
  segment(t2, e2, n2) {
    const r2 = "function" != typeof e2 ? e2 : {};
    return this.j = "function" == typeof e2 ? e2 : n2, Kc(this), pc(this, t2, r2), Yc(this);
  }
  La(t2, e2, n2, r2) {
    const i2 = "function" != typeof n2 ? n2 : {};
    return this.j = "function" == typeof n2 ? n2 : r2, Kc(this), gc(this, t2, i2, e2), Yc(this);
  }
  Da() {
    return this.u;
  }
  m() {
    var t2 = new gs();
    ds(t2, "image_in"), ds(t2, "norm_rect");
    const e2 = new rs();
    Mr(e2, Po, this.h);
    const n2 = new cs();
    Cn(n2, 2, "mediapipe.tasks.vision.image_segmenter.ImageSegmenterGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), n2.o(e2), fs(t2, n2), ga(this, t2), this.outputConfidenceMasks && (ps(t2, "confidence_masks"), as(n2, "CONFIDENCE_MASKS:confidence_masks"), ma(this, "confidence_masks"), this.g.aa("confidence_masks", ((t3, e3) => {
      this.confidenceMasks = t3.map(((t4) => mc(this, t4, true, !this.j))), pa(this, e3);
    })), this.g.attachEmptyPacketListener("confidence_masks", ((t3) => {
      this.confidenceMasks = [], pa(this, t3);
    }))), this.outputCategoryMask && (ps(t2, "category_mask"), as(n2, "CATEGORY_MASK:category_mask"), ma(this, "category_mask"), this.g.Z("category_mask", ((t3, e3) => {
      this.categoryMask = mc(this, t3, false, !this.j), pa(this, e3);
    })), this.g.attachEmptyPacketListener("category_mask", ((t3) => {
      this.categoryMask = void 0, pa(this, t3);
    }))), ps(t2, "quality_scores"), as(n2, "QUALITY_SCORES:quality_scores"), this.g.attachFloatVectorListener("quality_scores", ((t3, e3) => {
      this.qualityScores = t3, pa(this, e3);
    })), this.g.attachEmptyPacketListener("quality_scores", ((t3) => {
      this.categoryMask = void 0, pa(this, t3);
    })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
qc.prototype.getLabels = qc.prototype.Da, qc.prototype.segmentForVideo = qc.prototype.La, qc.prototype.segment = qc.prototype.segment, qc.prototype.setOptions = qc.prototype.o, qc.createFromModelPath = function(t2, e2) {
  return fc(qc, t2, { baseOptions: { modelAssetPath: e2 } });
}, qc.createFromModelBuffer = function(t2, e2) {
  return fc(qc, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, qc.createFromOptions = function(t2, e2) {
  return fc(qc, t2, e2);
};
var $c = class {
  constructor(t2, e2, n2) {
    this.confidenceMasks = t2, this.categoryMask = e2, this.qualityScores = n2;
  }
  close() {
    this.confidenceMasks?.forEach(((t2) => {
      t2.close();
    })), this.categoryMask?.close();
  }
};
$c.prototype.close = $c.prototype.close;
var Jc = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "image_in", "norm_rect_in", false), this.outputCategoryMask = false, this.outputConfidenceMasks = true, this.h = new Mo(), this.u = new Lo(), kn(this.h, 0, 3, this.u), kn(t2 = this.h, 0, 1, e2 = new Ks());
  }
  get baseOptions() {
    return wn(this.h, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.h, 0, 1, t2);
  }
  o(t2) {
    return "outputCategoryMask" in t2 && (this.outputCategoryMask = t2.outputCategoryMask ?? false), "outputConfidenceMasks" in t2 && (this.outputConfidenceMasks = t2.outputConfidenceMasks ?? true), super.l(t2);
  }
  segment(t2, e2, n2, r2) {
    const i2 = "function" != typeof n2 ? n2 : {};
    if (this.j = "function" == typeof n2 ? n2 : r2, this.qualityScores = this.categoryMask = this.confidenceMasks = void 0, n2 = this.C + 1, r2 = new Uo(), e2.keypoint && e2.scribble) throw Error("Cannot provide both keypoint and scribble.");
    if (e2.keypoint) {
      var s2 = new Co();
      dn(s2, 3, te(true), false), dn(s2, 1, Zt(e2.keypoint.x), 0), dn(s2, 2, Zt(e2.keypoint.y), 0), Sn(r2, 1, Do, s2);
    } else {
      if (!e2.scribble) throw Error("Must provide either a keypoint or a scribble.");
      {
        const t3 = new No();
        for (s2 of e2.scribble) dn(e2 = new Co(), 3, te(true), false), dn(e2, 1, Zt(s2.x), 0), dn(e2, 2, Zt(s2.y), 0), Ln(t3, 1, Co, e2);
        Sn(r2, 2, Do, t3);
      }
    }
    this.g.addProtoToStream(r2.g(), "mediapipe.tasks.vision.interactive_segmenter.proto.RegionOfInterest", "roi_in", n2), pc(this, t2, i2);
    t: {
      try {
        const t3 = new $c(this.confidenceMasks, this.categoryMask, this.qualityScores);
        if (!this.j) {
          var o2 = t3;
          break t;
        }
        this.j(t3);
      } finally {
        ya(this);
      }
      o2 = void 0;
    }
    return o2;
  }
  m() {
    var t2 = new gs();
    ds(t2, "image_in"), ds(t2, "roi_in"), ds(t2, "norm_rect_in");
    const e2 = new rs();
    Mr(e2, Po, this.h);
    const n2 = new cs();
    Cn(n2, 2, "mediapipe.tasks.vision.interactive_segmenter.InteractiveSegmenterGraphV2"), os(n2, "IMAGE:image_in"), os(n2, "ROI:roi_in"), os(n2, "NORM_RECT:norm_rect_in"), n2.o(e2), fs(t2, n2), ga(this, t2), this.outputConfidenceMasks && (ps(t2, "confidence_masks"), as(n2, "CONFIDENCE_MASKS:confidence_masks"), ma(this, "confidence_masks"), this.g.aa("confidence_masks", ((t3, e3) => {
      this.confidenceMasks = t3.map(((t4) => mc(this, t4, true, !this.j))), pa(this, e3);
    })), this.g.attachEmptyPacketListener("confidence_masks", ((t3) => {
      this.confidenceMasks = [], pa(this, t3);
    }))), this.outputCategoryMask && (ps(t2, "category_mask"), as(n2, "CATEGORY_MASK:category_mask"), ma(this, "category_mask"), this.g.Z("category_mask", ((t3, e3) => {
      this.categoryMask = mc(this, t3, false, !this.j), pa(this, e3);
    })), this.g.attachEmptyPacketListener("category_mask", ((t3) => {
      this.categoryMask = void 0, pa(this, t3);
    }))), ps(t2, "quality_scores"), as(n2, "QUALITY_SCORES:quality_scores"), this.g.attachFloatVectorListener("quality_scores", ((t3, e3) => {
      this.qualityScores = t3, pa(this, e3);
    })), this.g.attachEmptyPacketListener("quality_scores", ((t3) => {
      this.categoryMask = void 0, pa(this, t3);
    })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
Jc.prototype.segment = Jc.prototype.segment, Jc.prototype.setOptions = Jc.prototype.o, Jc.createFromModelPath = function(t2, e2) {
  return fc(Jc, t2, { baseOptions: { modelAssetPath: e2 } });
}, Jc.createFromModelBuffer = function(t2, e2) {
  return fc(Jc, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, Jc.createFromOptions = function(t2, e2) {
  return fc(Jc, t2, e2);
};
var Zc = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "input_frame_gpu", "norm_rect", false), this.j = { detections: [] }, kn(t2 = this.h = new Bo(), 0, 1, e2 = new Ks());
  }
  get baseOptions() {
    return wn(this.h, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.h, 0, 1, t2);
  }
  o(t2) {
    return void 0 !== t2.displayNamesLocale ? nn(this.h, 2, pe(t2.displayNamesLocale)) : "displayNamesLocale" in t2 && nn(this.h, 2), void 0 !== t2.maxResults ? Mn(this.h, 3, t2.maxResults) : "maxResults" in t2 && nn(this.h, 3), void 0 !== t2.scoreThreshold ? Pn(this.h, 4, t2.scoreThreshold) : "scoreThreshold" in t2 && nn(this.h, 4), void 0 !== t2.categoryAllowlist ? On(this.h, 5, t2.categoryAllowlist) : "categoryAllowlist" in t2 && nn(this.h, 5), void 0 !== t2.categoryDenylist ? On(this.h, 6, t2.categoryDenylist) : "categoryDenylist" in t2 && nn(this.h, 6), this.l(t2);
  }
  F(t2, e2) {
    return this.j = { detections: [] }, pc(this, t2, e2), this.j;
  }
  G(t2, e2, n2) {
    return this.j = { detections: [] }, gc(this, t2, n2, e2), this.j;
  }
  m() {
    var t2 = new gs();
    ds(t2, "input_frame_gpu"), ds(t2, "norm_rect"), ps(t2, "detections");
    const e2 = new rs();
    Mr(e2, Go, this.h);
    const n2 = new cs();
    Cn(n2, 2, "mediapipe.tasks.vision.ObjectDetectorGraph"), os(n2, "IMAGE:input_frame_gpu"), os(n2, "NORM_RECT:norm_rect"), as(n2, "DETECTIONS:detections"), n2.o(e2), fs(t2, n2), this.g.attachProtoVectorListener("detections", ((t3, e3) => {
      for (const e4 of t3) t3 = ks(e4), this.j.detections.push(Ko(t3));
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("detections", ((t3) => {
      pa(this, t3);
    })), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
Zc.prototype.detectForVideo = Zc.prototype.G, Zc.prototype.detect = Zc.prototype.F, Zc.prototype.setOptions = Zc.prototype.o, Zc.createFromModelPath = async function(t2, e2) {
  return fc(Zc, t2, { baseOptions: { modelAssetPath: e2 } });
}, Zc.createFromModelBuffer = function(t2, e2) {
  return fc(Zc, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, Zc.createFromOptions = function(t2, e2) {
  return fc(Zc, t2, e2);
};
var Qc = class {
  constructor(t2, e2, n2) {
    this.landmarks = t2, this.worldLandmarks = e2, this.segmentationMasks = n2;
  }
  close() {
    this.segmentationMasks?.forEach(((t2) => {
      t2.close();
    }));
  }
};
function th(t2) {
  t2.landmarks = [], t2.worldLandmarks = [], t2.segmentationMasks = void 0;
}
function eh(t2) {
  try {
    const e2 = new Qc(t2.landmarks, t2.worldLandmarks, t2.segmentationMasks);
    if (!t2.u) return e2;
    t2.u(e2);
  } finally {
    ya(t2);
  }
}
Qc.prototype.close = Qc.prototype.close;
var nh = class extends yc {
  constructor(t2, e2) {
    super(new lc(t2, e2), "image_in", "norm_rect", false), this.landmarks = [], this.worldLandmarks = [], this.outputSegmentationMasks = false, kn(t2 = this.h = new jo(), 0, 1, e2 = new Ks()), this.A = new Eo(), kn(this.h, 0, 3, this.A), this.j = new vo(), kn(this.h, 0, 2, this.j), Mn(this.j, 4, 1), Pn(this.j, 2, 0.5), Pn(this.A, 2, 0.5), Pn(this.h, 4, 0.5);
  }
  get baseOptions() {
    return wn(this.h, Ks, 1);
  }
  set baseOptions(t2) {
    kn(this.h, 0, 1, t2);
  }
  o(t2) {
    return "numPoses" in t2 && Mn(this.j, 4, t2.numPoses ?? 1), "minPoseDetectionConfidence" in t2 && Pn(this.j, 2, t2.minPoseDetectionConfidence ?? 0.5), "minTrackingConfidence" in t2 && Pn(this.h, 4, t2.minTrackingConfidence ?? 0.5), "minPosePresenceConfidence" in t2 && Pn(this.A, 2, t2.minPosePresenceConfidence ?? 0.5), "outputSegmentationMasks" in t2 && (this.outputSegmentationMasks = t2.outputSegmentationMasks ?? false), this.l(t2);
  }
  F(t2, e2, n2) {
    const r2 = "function" != typeof e2 ? e2 : {};
    return this.u = "function" == typeof e2 ? e2 : n2, th(this), pc(this, t2, r2), eh(this);
  }
  G(t2, e2, n2, r2) {
    const i2 = "function" != typeof n2 ? n2 : {};
    return this.u = "function" == typeof n2 ? n2 : r2, th(this), gc(this, t2, i2, e2), eh(this);
  }
  m() {
    var t2 = new gs();
    ds(t2, "image_in"), ds(t2, "norm_rect"), ps(t2, "normalized_landmarks"), ps(t2, "world_landmarks"), ps(t2, "segmentation_masks");
    const e2 = new rs();
    Mr(e2, Vo, this.h);
    const n2 = new cs();
    Cn(n2, 2, "mediapipe.tasks.vision.pose_landmarker.PoseLandmarkerGraph"), os(n2, "IMAGE:image_in"), os(n2, "NORM_RECT:norm_rect"), as(n2, "NORM_LANDMARKS:normalized_landmarks"), as(n2, "WORLD_LANDMARKS:world_landmarks"), n2.o(e2), fs(t2, n2), ga(this, t2), this.g.attachProtoVectorListener("normalized_landmarks", ((t3, e3) => {
      this.landmarks = [];
      for (const e4 of t3) t3 = Rs(e4), this.landmarks.push(Yo(t3));
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("normalized_landmarks", ((t3) => {
      this.landmarks = [], pa(this, t3);
    })), this.g.attachProtoVectorListener("world_landmarks", ((t3, e3) => {
      this.worldLandmarks = [];
      for (const e4 of t3) t3 = xs(e4), this.worldLandmarks.push(qo(t3));
      pa(this, e3);
    })), this.g.attachEmptyPacketListener("world_landmarks", ((t3) => {
      this.worldLandmarks = [], pa(this, t3);
    })), this.outputSegmentationMasks && (as(n2, "SEGMENTATION_MASK:segmentation_masks"), ma(this, "segmentation_masks"), this.g.aa("segmentation_masks", ((t3, e3) => {
      this.segmentationMasks = t3.map(((t4) => mc(this, t4, true, !this.u))), pa(this, e3);
    })), this.g.attachEmptyPacketListener("segmentation_masks", ((t3) => {
      this.segmentationMasks = [], pa(this, t3);
    }))), t2 = t2.g(), this.setGraph(new Uint8Array(t2), true);
  }
};
nh.prototype.detectForVideo = nh.prototype.G, nh.prototype.detect = nh.prototype.F, nh.prototype.setOptions = nh.prototype.o, nh.createFromModelPath = function(t2, e2) {
  return fc(nh, t2, { baseOptions: { modelAssetPath: e2 } });
}, nh.createFromModelBuffer = function(t2, e2) {
  return fc(nh, t2, { baseOptions: { modelAssetBuffer: e2 } });
}, nh.createFromOptions = function(t2, e2) {
  return fc(nh, t2, e2);
}, nh.POSE_CONNECTIONS = Dc;
export {
  Ja as DrawingUtils,
  _c as FaceDetector,
  Ic as FaceLandmarker,
  na as FilesetResolver,
  Oc as GestureRecognizer,
  Uc as HandLandmarker,
  Vc as HolisticLandmarker,
  Xc as ImageClassifier,
  Hc as ImageEmbedder,
  qc as ImageSegmenter,
  Wc as ImageSegmenterResult,
  Jc as InteractiveSegmenter,
  $c as InteractiveSegmenterResult,
  oc as MPImage,
  Ga as MPMask,
  Zc as ObjectDetector,
  nh as PoseLandmarker,
  _a as TaskRunner,
  yc as VisionTaskRunner
};
//# sourceMappingURL=@mediapipe_tasks-vision.js.map
