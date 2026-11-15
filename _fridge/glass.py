"""Thin glass / clear plastic sheet for Mitsuba: real Fresnel reflection, straight-through transmission.

Mitsuba's own glass refracts, which a path tracer cannot aim light through: a
lamp above a glass shelf would light everything below it only by chance (heavy
noise). A fridge's shelves and bins are thin, flat sheets, where refraction just
shifts the image by a millimetre, so this material drops it. Reflection keeps
the exact Fresnel term of a thin slab (mirror-like at glancing angles, ~8%
head-on); whatever isn't reflected passes straight through as a "null"
interaction, which the volpath integrator lets shadow rays cross. Lighting
under the shelves is then sampled directly and renders clean.

Use on single sheets (one surface = the whole slab), with the volpath integrator.
"""
import drjit as dr
import mitsuba as mi


class ThinGlass(mi.BSDF):
    def __init__(self, props):
        mi.BSDF.__init__(self, props)
        self.ior = props.get('int_ior', 1.52)
        self.tint = mi.Color3f(props.get('tr', 1.0), props.get('tg', 1.0), props.get('tb', 1.0))
        both = mi.BSDFFlags.FrontSide | mi.BSDFFlags.BackSide
        self.m_components = [mi.BSDFFlags.DeltaReflection | both, mi.BSDFFlags.Null | both]
        self.m_flags = self.m_components[0] | self.m_components[1]

    def reflectance(self, si):
        r = mi.fresnel(dr.abs(mi.Frame3f.cos_theta(si.wi)), self.ior)[0]   # one air–glass interface
        return 2 * r / (1 + r)                                             # both faces + the bounces between

    def sample(self, ctx, si, sample1, sample2, active=True):
        R = self.reflectance(si)
        reflect = sample1 < R
        bs = mi.BSDFSample3f()
        bs.wo = dr.select(reflect, mi.reflect(si.wi), -si.wi)
        bs.pdf = dr.select(reflect, R, 1 - R)
        bs.eta = 1.0
        bs.sampled_type = dr.select(reflect, mi.UInt32(+mi.BSDFFlags.DeltaReflection), mi.UInt32(+mi.BSDFFlags.Null))
        bs.sampled_component = dr.select(reflect, mi.UInt32(0), mi.UInt32(1))
        weight = dr.select(reflect, mi.Color3f(1.0), self.tint)
        return bs, weight & active

    def eval(self, ctx, si, wo, active=True):
        return mi.Color3f(0.0)

    def pdf(self, ctx, si, wo, active=True):
        return mi.Float(0.0)

    def eval_pdf(self, ctx, si, wo, active=True):
        return mi.Color3f(0.0), mi.Float(0.0)

    def eval_null_transmission(self, si, active=True):
        return self.tint * (1 - self.reflectance(si))

    def to_string(self):
        return f'ThinGlass[ior={self.ior}]'


mi.register_bsdf('thinglass', lambda props: ThinGlass(props))
