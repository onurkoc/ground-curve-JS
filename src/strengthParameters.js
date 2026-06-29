/*jshint esversion: 7 */
// parameters for strength development of shotcrete
// see following for more information:
// Authors: Anna-Lena Hammer et al.
// Article: Empirical forecasting model to determine the strength 
//    development of shotcrete
// Journal: Geomechanics and Tunnelling, Volume 12, issue 6 p. 720-738
// Link: https://doi.org/10.1002/geot.201900054


// arange function as in numpy
function arange(start, end, step) {
    const arr = [];
    let count = start;
    const numberOfSteps = (end - start) / step;
    for (let index = start; index < numberOfSteps; index++) {
      arr.push(count);
      count += step;
    }
    return arr;
  }

var quantiles = {
    perc_5 : {
        a : -2.685,
        b : 3.752,
        c : 1.300,
        d : -0.972,
        f : 0.057,
        g : 0.486,
    },
    perc_10 : {
        a : -2.414,
        b : 3.791,
        c : 1.561,
        d : -0.949,
        f : 0.069,
        g : 0.462,
    },
    perc_25 : {
        a : -2.100,
        b : 2.252,
        c : 0.826,
        d : -0.532,
        f : 0.165,
        g : 0.335,
    },
    median : {
        a : -1.990,
        b : 2.106,
        c : 0.723,
        d : -0.475,
        f : 0.307,
        g : 0.244,
    },
    perc_75 : {
        a : -1.931,
        b : 2.097,
        c : 0.665,
        d : -0.483,
        f : 0.415,
        g : 0.209,
    },
    perc_90 : {
        a : -1.931,
        b : 2.271,
        c : 0.634,
        d : -0.574,
        f : 0.479,
        g : 0.212,
    },
    perc_95 : {
        a : -2.015,
        b : 2.468,
        c : 0.578,
        d : -0.693,
        f : 0.381,
        g : 0.273,
    },
};

// Strength development of shotcrete in time acc. Anne-Lena Hammer et al.
function strengthTime(quantile, f_c) {
    const strength = [];
    const a = quantile.a;
    const b = quantile.b;
    const c = quantile.c;
    const d = quantile.d;
    const f = quantile.f;
    const g = quantile.g;
    const timeHours = arange(0, 24 * 28, 1); // hours
    for (let index = 0; index < timeHours.length; index++) {
        let n_c;
        if (timeHours[index] <= 48) {
        n_c = 10 ** (a + b / 
            (1 + Math.exp((-c + Math.log10(timeHours[index]) / d))));
        } else {
        n_c = f * (timeHours[index])**g;
        }
        if (timeHours[index] % 24 === 0) {
        strength.push(n_c * f_c);
        }
    }
    return strength;
}

var strength_ = strengthTime(quantiles.median, f_ck);

const p_scmaxSecond = strength_.map(item => {
    return item / 2 * (1 - ((D / 2 - t_c) ** 2 / (D / 2) ** 2));
});
// non-linear target support pressure acc. Anne-Lena Hammer

module.exports.median = quantiles.median;
