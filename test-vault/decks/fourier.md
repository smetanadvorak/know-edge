# Fourier transform ^384ten
Q: What is the Fourier transform?
A: Decomposition of a signal into its frequency components:
$$X(f) = \int_{-\infty}^{\infty} x(t)\, e^{-2\pi i f t}\, dt$$

## Gaussian ^p70n0p
Q: What is the transform of $e^{-\pi t^2}$?
A: Itself: $e^{-\pi f^2}$.

## Inverse ^zxz2ei
Q: What is the inverse Fourier transform?
A: $$x(t) = \int_{-\infty}^{\infty} X(f)\, e^{2\pi i f t}\, df$$

### Normalization ^alxyf9
Q: Why is there no $\frac{1}{2\pi}$ factor in this convention?
A: Using ordinary frequency $f$ (not $\omega$) puts the $2\pi$ in the exponent.
