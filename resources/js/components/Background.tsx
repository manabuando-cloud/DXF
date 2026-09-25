/** Blueprint grid, drifting glow orbs and a faint horizon line. Purely decorative. */
export function Background() {
    return (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0d1830_0%,#05070d_60%)]" />
            <div className="grid-floor absolute inset-x-0 top-0 h-[80vh] [transform:perspective(900px)_rotateX(55deg)_translateY(-18%)] origin-top" />
            <div className="animate-float absolute -left-40 top-24 h-[28rem] w-[28rem] rounded-full bg-cyan/20 blur-[120px]" />
            <div className="animate-float absolute -right-32 top-72 h-[32rem] w-[32rem] rounded-full bg-violet/20 blur-[140px] [animation-delay:-3s]" />
            <div className="absolute inset-x-0 top-[62vh] h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
        </div>
    );
}
