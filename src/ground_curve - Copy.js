/* eslint-disable no-undef */
const math = require('math');  // math.js
const plotly = require('plotly.js-dist');  // plotting
const regression = require('regression');
const lineIntersect = require('@turf/line-intersect').default;
const helpers =require('@turf/helpers');

/* eslint-disable no-undef */
const gammaSlider = document.getElementById('gammaSlider');
const heightSlider = document.getElementById('heightSlider');
const nuSlider = document.getElementById('nuSlider');
const elasticitySlider = document.getElementById('elasticitySlider');
const diameterSlider = document.getElementById('diameterSlider');
const cohesionSlider = document.getElementById('cohesionSlider');
const frictionSlider = document.getElementById('frictionSlider');
const concStrengthSlider = document.getElementById('concStrengthSlider');
const concElasticitySlider = document.getElementById('concElasticitySlider');
const concNuSlider = document.getElementById('concNuSlider');
const concThicknessSlider = document.getElementById('concThicknessSlider');
const distSupportSlider = document.getElementById('distSupportSlider');
const advanceRateSlider = document.getElementById('advanceRateSlider');

const gammaInput = document.getElementById('gammaInput');
const heightInput = document.getElementById('heightInput');
const nuInput = document.getElementById('nuInput');
const elasticityInput = document.getElementById('elasticityInput');
const diameterInput = document.getElementById('diameterInput');
const cohesionInput = document.getElementById('cohesionInput');
const frictionInput = document.getElementById('frictionInput');
const concStrengthInput = document.getElementById('concStrengthInput');
const concElasticityInput = document.getElementById('concElasticityInput');
const concNuInput = document.getElementById('concNuInput');
const concThicknessInput = document.getElementById('concThicknessInput');
const distSupportInput = document.getElementById('distSupportInput');
const advanceRateInput = document.getElementById('advanceRateInput');

function groundCurve(gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
  dis_sup, advance_rate) {
  /*
  --------------------------------
  Input values for rock/soil
  --------------------------------
  gamma        - [kN/m³] - specific weight of the rock mass
  H            - [m]     - overburden
  nu           - [-]     - Poisson's ratio of the rock
  E            - [kPa]   - Modulus of elasticity of the rock
  D            - [m]     - Diameter of the tunnel
  c            - [kPa]   - Cohesion
  phi          - [deg]   - Friction angle
  --------------------------------
  Input values for support members
  --------------------------------
  f_ck         - [MPa]   - Uniaxial compressive strength of the
                              sprayed concrete
  E_c          - [MPa]   - Young's modulus of the sprayed concrete
  nu_c         - [-]     - Poisson's ratio of the sprayed concrete
  t_c          - [m]     - Thickness of the sprayed concrete
  dis_sup      - [m]     - Distance of the support member to the face
  advance_rate - [m/day] - Rate of advance
  */

  // map all variables into number type again
  // all variables come from html slider => variable.value
  const variables = [gamma.value, H.value, nu.value, E.value, D.value, c.value,
  phi.value, f_ck.value, E_c.value, nu_c.value, t_c.value,
  dis_sup.value, advance_rate.value];

  variablesTypeNumber = variables.map(Number);
  [gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
    dis_sup, advance_rate] = variablesTypeNumber;

  const p_o = gamma * H;  // [kPa] - in situ stress
  const Phi = phi * math.PI / 180;
  // [rad] - conversion from degrees to radians

  // linspace function as in numpy
  function linspace(start, end, step) {
    //1. devides the range between start-end 
    //2. gives step number of integers in array
    //note: works only for integer steps and steps greater than 1
    const arr = [];
    let count = start;
    for (let index = start; index < step; index++) {
      if (index === step - 1) {
        arr.push(end);
      } else {
        arr.push(count);
      }
      count += (end - start) / step;
    }
    return arr;
  }

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

  const p_i = linspace(0, p_o, 5000);

  const sigma_cm = 2 * c * math.cos(Phi) / (1 - math.sin(Phi));
  // [kPa] - the uniaxial strength of the rock mass

  const k = (1 + math.sin(Phi)) / (1 - math.sin(Phi));
  // [-] - slope defined by the Mohr-Coulomb criterion

  // Analysis of tunnel behaviour:

  /*
  #############################
  a. Tunnel wall displacement
  #############################
  */

  const p_cr = (2 * p_o - sigma_cm) / (1 + k);
  // [kPa] - critical support pressure
  // if the critical support pressure is smaller than the internal
  // support pressure then failure does not occur

  const r_o = D / 2;
  // [m] - radius of the tunnel

  const u_ie = [];
  p_i.forEach(element => {
    u_ie.push(r_o * (1 + nu) / E * (p_o - element));
  });
  // [m] - inward radial elastic displacement (Pi is a variable)

  const r_p = [];
  p_i.forEach(element => {
    r_p.push(r_o * (2 * (p_o * (k - 1) + sigma_cm) / (1 + k) /
      ((k - 1) * element + sigma_cm)) ** (1 / (k - 1)));
  });
  // [m] - radius of the plastic zone
  // if the support pressure is higher than critical pressure then the
  // plastic radius is equal to tunnel radius

  const u_ip = [];
  p_i.forEach((element, index) => {
    u_ip.push(
      r_o * (1 + nu) / E * (2 * (1 - nu) * (p_o - p_cr) *
        (r_p[index] / r_o) ** 2 - (1 - 2 * nu) * (p_o - element)),
    );
  });
  // [m] - inward radial plastic displacement (Pi is a variable)

  const x = [];
  p_i.forEach((item, index) => {
    if (item > p_cr) {
      x.push(u_ie[index]);
    } else {
      x.push(u_ip[index]);
    }
  });

  /*
  Accounting for large strain convergences
  According to Vrakas, Anagnostou Géotechnique 65, No. 11 936-944 equation (1)
  http://dx.doi.org/10.1680/jgeot.15.P.036
  */
  const xLargeStrain = [];
  p_i.forEach((item, index) => {
    if (item > p_cr) {
      // normalized with radius large strain
      let u_ieLargeStrainNormalized = 
        1 - (1 / math.sqrt(1 + 2 * u_ie[index] / r_o));
      // denormalized large strain
      let u_ieLargeStrain =  u_ieLargeStrainNormalized * r_o
      xLargeStrain.push(u_ieLargeStrain);
    } else {
      // normalized
      let u_ipLargeStrainNormalized = 
        1 - (1 / math.sqrt(1 + 2 * u_ip[index] / r_o));
      // denormalized
      let u_ipLargeStrain =  u_ipLargeStrainNormalized * r_o
      xLargeStrain.push(u_ipLargeStrain);
    }
  })

  const y = p_i.map(x => x / 1000);
  // [m] - displacement before and after critical support pressure
  // x values to draw the blue ground curve
  // y values are y = p_i / 1000 : [MPa]

  const goal = p_cr;
  const x_cr_p_i_value = p_i.reduce(function (prev, curr) {
    return (math.abs(curr - goal) < math.abs(prev - goal) ? curr : prev);
  });
  const x_cr_index = p_i.indexOf(x_cr_p_i_value);
  const x_cr = u_ie[x_cr_index];

  /*
  #####################################
  b. Longitudinal displacement profile
  #####################################
  */

  const r_pm = r_o * ((2 * (p_o * (k - 1) + sigma_cm)) / ((1 + k) *
    sigma_cm)) ** (1 / (k - 1));
  // Maximum plastic zone radius [m]

  const u_im = r_o * (1 + nu) / E * (2 * (1 - nu) * (p_o - p_cr) *
    (r_pm / r_o) ** 2 - (1 - 2 * nu) * (p_o));
  // Maximum displacement [m] - r_p = r_pm; p_i = 0

  const u_if = (u_im / 3) * math.exp(-0.15 * (r_pm / r_o));
  // Displacement at the tunnel face (by Vlachopoulus and Diederichs) [m]

  // Calculate the displacement ahead of the face:
  const x_ = arange(-25, 80, 0.1);
  // Distance from tunnel face (an array from -25m ahead and 80m behind the
  // face) [m]

  const u_ix_a = [];
  x_.forEach(item => {
    u_ix_a.push(
      (u_if) * math.exp(item / r_o)
    );
  });
  // Tunnel wall displacement ahead of the face (x < 0) [m]
  // NOT NORMALIZED! meaning: * u_im

  // Calculate the displacement behind the face:
  const u_ix_b = [];
  x_.forEach(item => {
    u_ix_b.push(
      u_im * (1 - (1 - u_if / u_im) *
        math.exp((-3 * item / r_o) / (2 * r_pm / r_o)))
    );
  });
  // Tunnel wall displacement behind the face (x > 0) [m]
  // NOT NORMALIZED! meaning: * u_im

  const x_disp = [];
  x_.forEach((item, index) => {
    if (item < 0) {
      x_disp.push(u_ix_a[index]);
    } else {
      x_disp.push(u_ix_b[index]);
    }
  });
  // x values for longitudinal displacement profile (LDP)

  /*
  ################################################
  # c. Calculate the actual/target strength of SCL
  ################################################
  */

  const u_io = u_im * (1 - (1 - u_if / u_im) *
    math.exp((-3 * dis_sup / r_o) / (2 * r_pm / r_o)));
  // Tunnel wall displacement behind SCL x > distance support [m]

  const p_scmax_el = f_ck / 2 * (1 - ((D / 2 - t_c) ** 2 / (D / 2) ** 2));
  const k_sc_el = E_c * ((D / 2) ** 2 - (D / 2 - t_c) ** 2) / (
    2 * (1 - nu_c ** 2) * (D / 2 - t_c) * (D / 2) ** 2);
  // elastic design

  // non-linear stress calculation for rate of flow
  const time_672hours = arange(0, 28 * 24, 1); // [hours]
  const time_28days = time_672hours.map(item => item / 24); // [days]

  // Strength evolution of SCL acc. Aldrian
  const sigma = [];
  time_672hours.forEach(time => {
    if (time < 8) {
      sigma.push(f_ck * 0.03 * time);
    } else {
      sigma.push(f_ck * math.sqrt((time - 5) / (45 + 0.925 * time)));
    }
  });

  const p_scmax = sigma.map(item => {
    return item / 2 * (1 - ((D / 2 - t_c) ** 2 / (D / 2) ** 2));
  });
  // non-linear target support pressure

  const ratio_sc = p_scmax_el / k_sc_el
  const u_iy = u_io + ratio_sc
  // displacement at the yield surface of support

  const x_support_el = [u_io, u_iy, u_iy * 1.005];
  const y_support_el = [0, p_scmax_el, p_scmax_el];
  // support curve x and y data

  const data_object = {
    groundCurve: {
      x: x,
      y: y
    },
    groundCurveLargeStrain: {
      x: xLargeStrain,
      y: y
    },
    supportCurve: {
      x: x_support_el,
      y: y_support_el
    },
    originalLDP: {
      x: x_disp,
      y: x_
    },
    targetSupportPressure: {
      x: time_28days,
      y: p_scmax
    },
    targetStress: {
      x: time_28days,
      y: sigma
    },
    criticalPoint: {
        x: (p_cr > 0) ? [x_cr]:[],
        //x: [x_cr],
        y: (p_cr > 0) ? [p_cr / 1000]:[],
        //y: [p_cr / 1000],
    },
  };

  const groundCurvePoints = [];
  for (let index = 0; index < x.length; index++) {
    groundCurvePoints.push({
      x: x[index],
      y: y[index],
    });
  }

  const groundCurvePointsTest = [];
  for (let index = 0; index < x.length; index++) {
    groundCurvePointsTest.push(
      [
        x[index], 
        y[index]
      ]
    );
  }
  
  const supportCurvePoints = [];
  for (let index = 0; index < x_support_el.length; index++) {
    supportCurvePoints.push({
      x: x_support_el[index],
      y: y_support_el[index],
    });
  }

  const supportCurvePointsTest = [];
  for (let index = 0; index < x_support_el.length; index++) {
    supportCurvePointsTest.push(
      [
        x_support_el[index], 
        y_support_el[index]
      ]
    );
  }

  var groundCurveLine = helpers.lineString(groundCurvePointsTest);
  var supportCurveLine = helpers.lineString(supportCurvePointsTest);

  var intersectTest = lineIntersect(
    groundCurveLine,
    supportCurveLine
    );

  console.log(intersectTest.features[0].geometry.coordinates);

  //usage -> intersectTest.features[0].geometry.coordinates
  //returns -> an array with x and y coordinates

  let intersection = findSegmentIntersection(groundCurvePoints,
    supportCurvePoints);
  if (intersection) {
    var safetyFactor = (p_scmax_el / intersection.y).toFixed(3);
    var p_point = []; // [kPa]
    x.forEach((item, index) => {
      if (item > intersection.x) {
        p_point.push(p_i[index]);
      }
    });
    var x_updated = linspace(-25, 80, p_point.length); // [m]

    // varying the distance from tunnel face
    var p_scl = linspace(u_io, intersection.x, p_point.length); // [m]
    var p_point_x = [], p_x_l = [], p_y_l = [];

    // find the radius of plastic zone at the equilibrium point
    var r_pl_sup = r_o * (2 * (p_o * (k - 1) + sigma_cm) / (1 + k) / (
      (k - 1) * math.max(...p_point) + sigma_cm)) ** (1 / (k - 1));
    
    // define zip function which zips two arrays as pairs
    zip = (...rows) => [...rows[0]].map((_, c) => rows.map(row => row[c]));
    var zippedArray = zip(p_scl, p_point);

    zippedArray.forEach(item => {
      const p_scl_inc = item[0], p_inc = item[1];
      const r_pl_sup_inc = r_o * (2 * (p_o * (k - 1) + sigma_cm) /
        (1 + k) / ((k - 1) * p_inc + sigma_cm)) ** (1 / (k - 1));
      const u_im_inc = r_o * (1 + nu) / E * (2 * (1 - nu) * (p_o - p_cr) *
        (r_pl_sup_inc / r_o) ** 2 - (1 - 2 * nu) * (p_o));
      const u_if_inc = (u_im_inc / 3) *
        math.exp(-0.15 * (r_pl_sup_inc / r_o));
      const u_ix_a_inc = [];
      x_updated.forEach(item => {
        u_ix_a_inc.push((u_if_inc) * math.exp(item / r_o))
      });
      const u_ix_b_inc = [];
      x_updated.forEach(item => {
        u_ix_b_inc.push(u_im_inc * (1 - (1 - u_if_inc / u_im_inc) *
          math.exp((-3 * item / r_o) / (2 * r_pl_sup_inc / r_o))))
      });
      const u_ix_inc = [];
      x_updated.forEach((item, index) => {
        if (item < 0) {
          u_ix_inc.push(u_ix_a_inc[index]);
        } else {
          u_ix_inc.push(u_ix_b_inc[index]);
        }
      });
      p_point_x.push(u_ix_inc);
      // intersection points with vertical lines
      const pointsVertical = [{ x: p_scl_inc, y: 0 },
      { x: p_scl_inc, y: 50 }];
      const pointsCurve = [];
      u_ix_inc.forEach((item, index) => {
        pointsCurve.push({ x: item, y: x_updated[index] });
      });
      const intersectLDC = findSegmentIntersection(
        pointsCurve, pointsVertical);
      if (intersectLDC) {
        p_x_l.push(intersectLDC.x);
        p_y_l.push(intersectLDC.y);
      }
    });
    // update the longitudinal displacement behind the face
    const u_im_updated = r_o * (1 + nu) / E * (
      2 * (1 - nu) * (p_o - p_cr) * (r_pl_sup / r_o) ** 2 - (
        1 - 2 * nu) * (p_o));
    // Maximum displacement [m] - r_p = r_pm; p_i = 0
    const u_if_updated = (u_im_updated / 3) *
      math.exp(-0.15 * (r_pl_sup / r_o));
    // Displacement at the tunnel face (by Vlachopoulus and Diederichs) [m]
    const u_ix_a_updated = [];
    x_updated.forEach(item => {
      u_ix_a_updated.push((u_if_updated) * math.exp(item / r_o));
    });
    // Tunnel wall displacement ahead the face (x < 0) [m]
    const u_ix_b_updated = [];
    x_updated.forEach(item => {
      u_ix_b_updated.push(u_im_updated * (1 - (1 - u_if_updated /
        u_im_updated) * math.exp((-3 * item / r_o) /
          (2 * r_pl_sup / r_o))));
    });
    const u_ix_updated = [];
    x_updated.forEach((item, index) => {
      if (item < 0) {
        u_ix_updated.push(u_ix_a_updated[index]);
      } else {
        u_ix_updated.push(u_ix_b_updated[index]);
      }
    });
    // LDP graphical data
    // x6, y6: p8 = Plot(x=p_point_x, y=x_updated) - gray dashed lines
    // x7, y7: p9 = Plot(x=p_x_l, y=p_y_l)  points of the intersection
    const LDP = {
      grayDashed: { x: p_point_x, y: x_updated },
      redIntersect: { x: p_x_l, y: p_y_l }
    };
    // Add this value to data_object
    const arrROF = rateOfFlow(LDP.redIntersect, advance_rate, sigma);
    data_object['LDP'] = LDP
    data_object['actualStress'] = {
      x: arrROF[1].map(item => item / 24),  // time in days
      y: arrROF[0]
    }; // actual stress of the spc
  } else {
    // in case of no intersection provide empty values
    intersection = { x: [], y: [] };
    safetyFactor = 0.0;
  }

  return [data_object, intersection, safetyFactor];
}

function findIntersection(array) {
  const P1 = array[0], P2 = array[1], P3 = array[2], P4 = array[3];

  const x =
    ((P1.x * P2.y - P2.x * P1.y) * (P3.x - P4.x) -
      (P1.x - P2.x) * (P3.x * P4.y - P3.y * P4.x)) /
    ((P1.x - P2.x) * (P3.y - P4.y) - (P1.y - P2.y) * (P3.x - P4.x));
  const y =
    ((P1.x * P2.y - P2.x * P1.y) * (P3.y - P4.y) -
      (P1.y - P2.y) * (P3.x * P4.y - P3.y * P4.x)) /
    ((P1.x - P2.x) * (P3.y - P4.y) - (P1.y - P2.y) * (P3.x - P4.x));
  return { x: x, y: y };
}

function isPointBetween(p, a, b) {
  return ((a.x <= p.x && p.x <= b.x) || (a.x >= p.x && p.x >= b.x)) &&
    ((a.y <= p.y && p.y <= b.y) || (a.y >= p.y && p.y >= b.y));
}

function findSegmentIntersection(firstCurve, secondCurve) {
  // attention second curve can only have one segment
  // (two points: start, end)
  // whereas first curve can have more than one segment
  const P3 = secondCurve[0];
  const P4 = secondCurve[1];
  // looping through the first curve segments and checking if there is an
  // intersection
  for (let index = 0; index < firstCurve.length; index++) {
    if (index === firstCurve.length - 1) {
      break;
    }
    const P1 = firstCurve[index];
    const P2 = firstCurve[index + 1];
    const points = [P1, P2, P3, P4];
    const i1 = findIntersection(points);
    const isIntersected = isPointBetween(i1, P1, P2) &&
      isPointBetween(i1, P3, P4);
    if (isIntersected) {
      return i1;
    }
  }
  return false;
}

// eslint-disable-next-line no-unused-vars
function isSegmentIntersected(points) {
  const i1 = findIntersection(points);
  const P1 = points[0], P2 = points[1], P3 = points[2], P4 = points[3];
  return isPointBetween(i1, P1, P2) && isPointBetween(i1, P3, P4);
}

function rateOfFlow(dispObj, rate, stress) {
  // dispObj: x, y object of intersection points
  // rate: advance rate
  const wall_disp = dispObj.x, dist_to_face = dispObj.y;
  const arr_disp = wall_disp.map(item => item - wall_disp[0]);
  const arr_dist_to_scl = dist_to_face.map(item => item - dist_to_face[0]);
  // subtract the initial displacement of the wall and the initial
  // displacement of the scl to set it zero
  // Calculate the time from advance rate
  const arr_days = arr_dist_to_scl.map(item => item / rate);
  const arr_hours = arr_days.map(item => item * 24);
  const del_eps = [];
  arr_disp.slice(1).forEach((item, index) => {
    del_eps.push(item - arr_disp.slice(0, -1)[index]);
  });

  // stress in lining in time [hours]
  const sigma = stress;

  // Constants for rate of flow calculation
  const E_28 = 15000;  // [MPa]
  const A = 0.0001;  // [1/MPa*d^(1/3)]
  const B = 600;  // [d]
  const eps_sh_inf = 0.00125;
  const C_d_inf = 0.00009;  // [1/MPa]
  const Q = 0.0001;  // [1/MPa]
  // delta C_t
  const C_t = arr_days.map(item => A * item ** (1 / 3));
  // strains due to temperature
  const theta = arr_days.map(item => item ** 0.25 * 250);
  // in degrees
  const eps_t = theta.map(
    item => (-1 * math.cos(math.PI / 180 * item) + 1) * 30 / 1000000);
  // change of elasticity in time
  const P_Ar1 = 1
  const P_Ar2 = 0.3
  const P_Ar3 = 0.2
  const E_t = arr_days.map(
    item => E_28 * (item / (P_Ar1 + P_Ar2 * item)) ** P_Ar3);
  // strains due to shrinkage
  const eps_sh = arr_days.map(
    item => eps_sh_inf * item / (item + B));

  const eps_d = [];
  const sigmaROF = [];  // Sigma calculated in flow rate function
  for (let index = 0; index < arr_days.length; index++) {
    if (index === arr_days.length - 1) {
      break;
    }
    if (index === 0) {
      // start with zero values
      eps_d.push(0);
      sigmaROF.push(0);
    } else {
      const del_eps_sh = eps_sh[index] - eps_sh[index - 1];
      // const del_eps_t = eps_t[index] - eps_t[index - 1];
      const del_C_t = C_t[index] - C_t[index - 1];
      const value_eps_d = (sigma[index] * C_d_inf -
        eps_d[index - 1]) * (1 - math.exp(-del_C_t / Q));
      eps_d.push(value_eps_d);
      const epsilon_total = eps_d[index - 1] + del_eps[index - 1] +
        sigma[index - 1] * del_C_t + value_eps_d + del_eps_sh;
      const value_sigma_2 = epsilon_total * E_t[index];
      //const value_sigma_2 = ((del_eps[index] - del_eps_sh - del_eps_t +
      //  eps_d[index - 1] * (1 - math.exp(-del_C_t / Q)) +
      //  sigma_2[index - 1] / E_t[index]) / (C_d_inf *
      //    (1 - math.exp(-del_C_t / Q)) + del_C_t + (1 / E_t[index])));
      sigmaROF.push(value_sigma_2)
    }
  }
  return [sigmaROF, arr_hours];
}

function updateGraphic(gammaValue, heightValue, nuValue, elasticityValue,
  diameterValue, cohesionValue, frictionValue, concStrengthValue,
  concElasticityValue, concNuValue, concThicknessValue, distSupportValue,
  advanceRateValue) {
  // To be called from updateSlider and updateInput functions
  const data_array = groundCurve(gammaValue, heightValue, nuValue,
    elasticityValue, diameterValue, cohesionValue, frictionValue,
    concStrengthValue, concElasticityValue, concNuValue, concThicknessValue,
    distSupportValue, advanceRateValue);
  const obj = data_array[0];
  const intersect = data_array[1];
  const safety = data_array[2];

  /* Plotly Graph */
  const trace1 = {
    x: obj.groundCurve.x,
    y: obj.groundCurve.y,
    mode: 'lines',
    type: 'scatter',
    name: 'Ground Curve SS*',
    line: {
      color: 'blue',
    },
    xaxis: 'x1',
    yaxis: 'y1',
    hoverinfo: 'x+y'
  };
  // Ground curve for large strains
  const trace1_1 = {
    x: obj.groundCurveLargeStrain.x,
    y: obj.groundCurveLargeStrain.y,
    mode: 'lines',
    type: 'scatter',
    name: 'Ground Curve LS**',
    line: {
      color: 'darkturquoise',
      dash: 'dashdot',
      opacity: 0.7,
    },
    xaxis: 'x1',
    yaxis: 'y1',
    hoverinfo: 'none'
  };
  const trace2 = {
    x: obj.supportCurve.x,
    y: obj.supportCurve.y,
    mode: 'lines',
    type: 'scatter',
    name: 'Support (LE)',
    line: {
      color: 'red',
    },
    xaxis: 'x1',
    yaxis: 'y1',
  };
  const trace3 = {
    x: [intersect.x],
    y: [intersect.y],
    mode: 'markers',
    type: 'scatter',
    name: `FS. ${Number(safety).toFixed(3)}`,
    marker: {
      color: 'green',
      size: 7,
    },
    xaxis: 'x1',
    yaxis: 'y1',
  };
  const trace3_1 = {
    x: obj.criticalPoint.x,
    y: obj.criticalPoint.y,
    mode: 'markers',
    type: 'scatter',
    name: (obj.criticalPoint.x.length) ? 
      `Pcr: ${obj.criticalPoint.y[0].toFixed(3)}`: "",
    marker: {
      color: 'brown',
      size: 7,
    },
    xaxis: 'x1',
    yaxis: 'y1',
  };

  const data = [trace1, trace1_1, trace2, trace3, trace3_1];

  if (Object.keys(obj).includes('LDP')) {
    obj.LDP.grayDashed.x.forEach((item, index) => {
      if (index % 50 === 0) {
        const trace4 = {
          x: item,
          y: obj.LDP.grayDashed.y,
          mode: 'lines',
          line: {
            color: 'gray',
            width: 1,
            dash: 'dashdot'
          },
          visible: true,
          showlegend: false,
          hoverinfo: 'none',
          name: 'Diff. p_i',
          opacity: 0.4,
          xaxis: 'x1',
          yaxis: 'y2',
        };
        data.push(trace4);
      }
    });
    const trace5 = {
      x: obj.LDP.grayDashed.x[obj.LDP.grayDashed.x.length - 1], // last element
      y: obj.LDP.grayDashed.y,
      mode: 'lines',
      line: {
        color: 'green',
        width: 1.5,
        dash: 'dashdot',
      },
      visible: true,
      showlegend: false,
      hoverinfo: 'none',
      name: 'Diff. p_i',
      opacity: 1,
      xaxis: 'x1',
      yaxis: 'y2',
    };
    data.push(trace5);
    const trace6 = {
      x: obj.LDP.redIntersect.x,
      y: obj.LDP.redIntersect.y,
      mode: 'lines',
      name: 'New LDP',
      line: {
        color: 'red',
        width: 2,
      },
      xaxis: 'x1',
      yaxis: 'y2',
    };
    data.push(trace6);

    const trace10 = {
      x: obj.actualStress.x,
      y: obj.actualStress.y,
      mode: 'lines',
      name: 'Stress (actual)',
      line: {
        color: 'brown',
        width: 1,
        dash: 'dashdot',
        opacity: 0.5,
      },
      xaxis: 'x2',
      yaxis: 'y4',
      opacity: 0.5,
      // showlegend: false,
      // hoverinfo: 'x+y'
    };
    data.push(trace10);

    // interpolate the data from rate of Flow
    const regressionData = [];
    for (let index = 0; index < obj.actualStress.x.length; index++) {
      if (index === obj.actualStress.x.length - 1) {
        break;
      }
      regressionData.push([
        obj.actualStress.x[index], obj.actualStress.y[index]]);
    }

    const intpolated = regression.polynomial(regressionData, { order: 5 });
    const xActualStressInterpolated = [];
    const yActualStressInterpolated = [];
    intpolated.points.forEach(item => {
      xActualStressInterpolated.push(item[0]);
      yActualStressInterpolated.push(item[1]);
    });

    const trace11 = {
      x: xActualStressInterpolated,
      y: yActualStressInterpolated,
      mode: 'lines',
      name: 'Stress (interpolated)',
      line: {
        color: 'red',
      },
      xaxis: 'x2',
      yaxis: 'y4',
      // showlegend: false,
      // hoverinfo: 'x+y'
    };
    data.push(trace11);

    // vertical lines
    var verticalLines = [];
    for (const item of [obj.supportCurve.x[0], intersect.x]) {
      verticalLines.push({
        'type': 'line',
        'xref': 'x1',
        'yref': 'y2',
        'x0': item,
        'y0': 0,
        'x1': item,
        'y1': 80,
        'line': {
          'color': 'red',
          'width': 1.5,
          'dash': 'dashdot'
        },
        'opacity': 0.6
      });
      // use maximum value of ground curve support pressure
      var max = obj.groundCurve.y.reduce(function(a, b) {
          return Math.max(a, b);
      });
      // vertical line in ground curve pic for support start + end
      verticalLines.push({
        'type': 'line',
        'xref': 'x1',
        'yref': 'y1',
        'x0': item,
        'y0': 0,
        'x1': item,
        'y1': max,
        'line': {
          'color': 'gray',
          'width': 1.5,
          'dash': 'dashdot'
        },
        'opacity': 0.3
      });
    }
  }

  const trace7 = {
    x: obj.originalLDP.x,
    y: obj.originalLDP.y,
    mode: 'lines',
    name: 'Org. LDP',
    line: {
      color: 'blue',
      width: 1.5,
      dash: 'dashdot',
    },
    hoverinfo: 'none',
    xaxis: 'x1',
    yaxis: 'y2',
  };
  data.push(trace7);

  const trace8 = {
    x: obj.targetSupportPressure.x,
    y: obj.targetSupportPressure.y,
    mode: 'lines',
    name: 'S.P. target',
    line: {
      color: 'green',
    },
    xaxis: 'x2',
    yaxis: 'y3',
  };
  data.push(trace8);

  const trace9 = {
    x: obj.targetStress.x,
    y: obj.targetStress.y,
    mode: 'lines',
    name: 'Stress (target)',
    line: {
      color: 'green',
    },
    xaxis: 'x2',
    yaxis: 'y4',
  };
  data.push(trace9);

  const layout = {
    title: "Ground Reaction Curve",
    plot_bgcolor: '#f9f7f7',
    showlegend: true,
    titlefont: {
      size: 20
    },
    margin: {
      l: 50,
      r: 50,
      b: 50,
      t: 50,
      pad: 4,
    },
    height: 900,
    width: 1300,
    hovermode: 'closest',
    autosize: true,
    xaxis: {
      rangemode: 'normal',
      title: 'Tunnel Wall Displacement [m]',
      range: [0, math.max(obj.groundCurve.x)],
      tickformat: '.3f',
      domain: [0, 0.47],
      anchor: 'y2',
    },
    xaxis2: {
      title: 'Time [days]',
      tickformat: '.2f',
      domain: [0.55, 1],
      anchor: 'y4',
    },
    yaxis: {
      // scaleratio: 0.1,
      tickformat: '.2f',
      title: 'Support Pressure [MPa]',
      titlefont: {
        size: 12,
      },
      range: [0, math.max(obj.groundCurve.y)],
      domain: [0.55, 1],
    },
    yaxis2: {
      title: 'Distance from Tunnel Face [m]',
      tickformat: 'd',
      range: [80, -25],
      domain: [0, 0.50],
      anchor: 'x1',
    },
    yaxis3: {
      title: 'Support Pressure [MPa]',
      tickformat: '.2f',
      range: [0, math.max(obj.groundCurve.y)],
      domain: [0.55, 1],
      anchor: 'x2',
    },
    yaxis4: {
      title: 'Stress SpC [MPa]',
      tickformat: '.2f',
      domain: [0, 0.50],
      anchor: 'x2',
      rangemode: 'nonnegative',
    },
    legend: {
      traceorder: 'normal',
      font: {
        family: 'arial',
        size: 12,
        color: '#000',
      },
      bgcolor: '#E2E2E2',
      bordercolor: '#FFFFFF',
      borderwidth: 1.5,
    },
    shapes: verticalLines,
  };

  plotly.newPlot('graph', data, layout);
}

function updateSlider() {
  let gammaInput = document.getElementById('gammaInput');
  let heightInput = document.getElementById('heightInput');
  let nuInput = document.getElementById('nuInput');
  let elasticityInput = document.getElementById('elasticityInput');
  let diameterInput = document.getElementById('diameterInput');
  let cohesionInput = document.getElementById('cohesionInput');
  let frictionInput = document.getElementById('frictionInput');
  let concStrengthInput = document.getElementById('concStrengthInput');
  let concElasticityInput = document.getElementById('concElasticityInput');
  let concNuInput = document.getElementById('concNuInput');
  let concThicknessInput = document.getElementById('concThicknessInput');
  let distSupportInput = document.getElementById('distSupportInput');
  let advanceRateInput = document.getElementById('advanceRateInput');

  document.getElementById('gammaSlider').value = gammaInput.value;
  document.getElementById('heightSlider').value = heightInput.value;
  document.getElementById('nuSlider').value = nuInput.value;
  document.getElementById('elasticitySlider').value = elasticityInput.value;
  document.getElementById('diameterSlider').value = diameterInput.value;
  document.getElementById('cohesionSlider').value = cohesionInput.value;
  document.getElementById('frictionSlider').value = frictionInput.value;
  document.getElementById('concStrengthSlider').value = concStrengthInput.value;
  document.getElementById('concElasticitySlider').value = concElasticityInput.value;
  document.getElementById('concNuSlider').value = concNuInput.value;
  document.getElementById('concThicknessSlider').value = concThicknessInput.value;
  document.getElementById('distSupportSlider').value = distSupportInput.value;
  document.getElementById('advanceRateSlider').value = advanceRateInput.value;

  updateGraphic(gammaInput, heightInput, nuInput, elasticityInput,
    diameterInput, cohesionInput, frictionInput, concStrengthInput,
    concElasticityInput, concNuInput, concThicknessInput, distSupportInput,
    advanceRateInput);
}

function updateInput() {
  let gammaSlider = document.getElementById('gammaSlider');
  let heightSlider = document.getElementById('heightSlider');
  let nuSlider = document.getElementById('nuSlider');
  let elasticitySlider = document.getElementById('elasticitySlider');
  let diameterSlider = document.getElementById('diameterSlider');
  let cohesionSlider = document.getElementById('cohesionSlider');
  let frictionSlider = document.getElementById('frictionSlider');
  let concStrengthSlider = document.getElementById('concStrengthSlider');
  let concElasticitySlider = document.getElementById('concElasticitySlider');
  let concNuSlider = document.getElementById('concNuSlider');
  let concThicknessSlider = document.getElementById('concThicknessSlider');
  let distSupportSlider = document.getElementById('distSupportSlider');
  let advanceRateSlider = document.getElementById('advanceRateSlider');

  document.getElementById('gammaInput').value = gammaSlider.value;
  document.getElementById('heightInput').value = heightSlider.value;
  document.getElementById('nuInput').value = nuSlider.value;
  document.getElementById('elasticityInput').value = elasticitySlider.value;
  document.getElementById('diameterInput').value = diameterSlider.value;
  document.getElementById('cohesionInput').value = cohesionSlider.value;
  document.getElementById('frictionInput').value = frictionSlider.value;
  document.getElementById('concStrengthInput').value = concStrengthSlider.value;
  document.getElementById('concElasticityInput').value = concElasticitySlider.value;
  document.getElementById('concNuInput').value = concNuSlider.value;
  document.getElementById('concThicknessInput').value = concThicknessSlider.value;
  document.getElementById('distSupportInput').value = distSupportSlider.value;
  document.getElementById('advanceRateInput').value = advanceRateSlider.value;

  updateGraphic(gammaSlider, heightSlider, nuSlider, elasticitySlider,
    diameterSlider, cohesionSlider, frictionSlider, concStrengthSlider,
    concElasticitySlider, concNuSlider, concThicknessSlider, distSupportSlider,
    advanceRateSlider);
}

updateSlider();
updateInput();

gammaSlider.onchange = updateInput;
heightSlider.onchange = updateInput;
nuSlider.onchange = updateInput;
elasticitySlider.onchange = updateInput;
diameterSlider.onchange = updateInput;
cohesionSlider.onchange = updateInput;
frictionSlider.onchange = updateInput;
concStrengthSlider.onchange = updateInput;
concElasticitySlider.onchange = updateInput;
concNuSlider.onchange = updateInput;
concThicknessSlider.onchange = updateInput;
distSupportSlider.onchange = updateInput;
advanceRateSlider.onchange = updateInput;

gammaInput.onchange = updateSlider;
heightInput.onchange = updateSlider;
nuInput.onchange = updateSlider;
elasticityInput.onchange = updateSlider;
diameterInput.onchange = updateSlider;
cohesionInput.onchange = updateSlider;
frictionInput.onchange = updateSlider;
concStrengthInput.onchange = updateSlider;
concElasticityInput.onchange = updateSlider;
concNuInput.onchange = updateSlider;
concThicknessInput.onchange = updateSlider;
distSupportInput.onchange = updateSlider;
advanceRateInput.onchange = updateSlider;
